"""
Parse Deep Fashion image stems and build catalog family groupings.

Filename pattern (selected_images):
  {GENDER}-{category}-id_{family}-{variant}_{idx}_{view}.jpg

CSV ``product_id`` column is the dataset family id (e.g. ``id_00000020``).
Each JPEG stem is a distinct catalog SKU (``product_id`` in the API).
"""

from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from typing import Any

# Category price bands (kept in sync with api.py ``_PRICE_RANGES``).
PRICE_RANGES: dict[str, tuple[float, float]] = {
    "Denim": (39.99, 89.99),
    "Jackets_Vests": (59.99, 199.99),
    "Pants": (29.99, 79.99),
    "Shorts": (19.99, 49.99),
    "Skirts": (24.99, 69.99),
    "Shirts_Polos": (19.99, 59.99),
    "Tees_Tanks": (14.99, 39.99),
    "Sweaters": (34.99, 99.99),
    "Sweatshirts_Hoodies": (29.99, 79.99),
    "Dresses": (34.99, 129.99),
    "Suiting": (79.99, 299.99),
    "Blouses_Shirts": (24.99, 69.99),
    "Cardigans": (34.99, 89.99),
    "Rompers_Jumpsuits": (39.99, 99.99),
    "Graphic_Tees": (14.99, 34.99),
}


def price_for_family(family_id: str, category: str) -> float:
    """
    Stable synthetic price for a dataset ``product_id`` (family).

    All image stems / variants for the same ``family_id`` share this value.
    """
    lo, hi = PRICE_RANGES.get(category, (19.99, 79.99))
    if not family_id:
        return round((lo + hi) / 2, 2)
    digest = hashlib.md5(family_id.encode("utf-8")).hexdigest()
    unit = int(digest[:8], 16) / 0xFFFFFFFF
    return round(lo + unit * (hi - lo), 2)


def assign_family_prices(catalog: list[dict]) -> None:
    """Set ``price`` on every SKU from its dataset ``family_id`` (mutates catalog)."""
    cache: dict[str, float] = {}
    for item in catalog:
        fid = (item.get("family_id") or "").strip()
        if not fid:
            fid = item.get("product_id", "")
        if fid not in cache:
            cache[fid] = price_for_family(fid, item.get("category", "") or "unknown")
        item["price"] = cache[fid]

STEM_RE = re.compile(
    r"^(?P<gender>MEN|WOMEN)-(?P<category>.+)-id_(?P<family>\d+)-"
    r"(?P<variant>\d+)_(?P<idx>\d+)_(?P<view>front|back)$",
    re.IGNORECASE,
)


def family_key(gender: str, category: str, family_id: str) -> str:
    return f"{gender.upper()}|{category}|{family_id}"


def parse_family_id_from_row(row: dict) -> str:
    pid = (row.get("product_id") or "").strip()
    if pid:
        return pid
    return ""


def parse_stem_fields(stem: str, row: dict | None = None) -> dict[str, str]:
    """Derive family_id, look_variant, image_view from CSV row and/or stem."""
    row = row or {}
    family_id = parse_family_id_from_row(row)
    look_variant = ""
    image_view = (row.get("image_type") or "").strip().lower()

    m = STEM_RE.match(stem)
    if m:
        if not family_id:
            family_id = f"id_{m.group('family')}"
        look_variant = m.group("variant")
        if not image_view:
            image_view = m.group("view").lower()
    elif not family_id and "-id_" in stem:
        # Best-effort when regex fails
        try:
            tail = stem.split("-id_", 1)[1]
            fam_part = tail.split("-", 1)[0]
            family_id = f"id_{fam_part}"
            look_variant = tail.split("-", 1)[1].split("_", 1)[0]
        except (IndexError, ValueError):
            pass

    if not image_view:
        image_view = "front" if stem.endswith("_front") else "back" if stem.endswith("_back") else "front"

    return {
        "family_id": family_id,
        "look_variant": look_variant,
        "image_view": image_view,
    }


def enrich_catalog_item(item: dict, row: dict | None = None) -> dict:
    """Add family fields to a catalog dict (mutates and returns item)."""
    stem = item.get("product_id") or item.get("image_id") or ""
    fields = parse_stem_fields(stem, row)
    item["family_id"] = fields["family_id"]
    item["look_variant"] = fields["look_variant"]
    item["image_view"] = fields["image_view"]
    item["family_key"] = family_key(
        item.get("gender", "unknown"),
        item.get("category", "unknown"),
        fields["family_id"] or stem,
    )
    return item


def _item_matches_browse_filters(
    item: dict,
    *,
    gender: str | None,
    category: str | None,
    words: list[str],
) -> bool:
    if gender and item.get("gender", "").upper() != gender.upper():
        return False
    if category and item.get("category", "") != category:
        return False
    if not words:
        return True
    haystack = (
        f"{item.get('description', '')} {item.get('product_name', '')} "
        f"{item.get('family_id', '')}"
    ).lower()
    return any(w in haystack for w in words)


def _summaries_from_item_groups(groups: dict[str, list[dict]]) -> list[dict]:
    summaries: list[dict] = []
    for _key, items in groups.items():
        items_sorted = sorted(
            items,
            key=lambda x: (x.get("look_variant", ""), x.get("image_view", ""), x.get("product_id", "")),
        )
        rep = items_sorted[0]
        variants = sorted({i.get("look_variant", "") for i in items if i.get("look_variant")})
        summaries.append(
            {
                "family_id": rep.get("family_id", ""),
                "family_key": rep.get("family_key", ""),
                "gender": rep.get("gender", ""),
                "category": rep.get("category", ""),
                "product_name": rep.get("product_name", ""),
                "description": rep.get("description", ""),
                "price": rep.get("price", 0),
                "image_url": rep.get("image_url", ""),
                "default_product_id": rep.get("product_id", ""),
                "variant_count": len(variants),
                "variants": variants,
            }
        )

    summaries.sort(key=lambda s: (s.get("gender", ""), s.get("category", ""), s.get("family_id", "")))
    return summaries


def build_family_summaries(catalog: list[dict]) -> list[dict]:
    """One shop card per (gender, category, family_id) — used for deployment stats."""
    groups: dict[str, list[dict]] = defaultdict(list)
    for item in catalog:
        fid = item.get("family_id") or item.get("product_id", "")
        if not fid:
            continue
        groups[item["family_key"]].append(item)
    return _summaries_from_item_groups(groups)


def build_browse_summaries(
    catalog: list[dict],
    *,
    gender: str | None = None,
    category: str | None = None,
    q: str | None = None,
) -> list[dict]:
    """
    One shop card per dataset ``family_id`` within the active browse filters.

    When gender and/or category filters are set, only SKUs matching those filters
    are considered; each ``family_id`` appears at most once in the result.
    """
    words = [w for w in (q or "").lower().split() if w]
    groups: dict[str, list[dict]] = defaultdict(list)
    for item in catalog:
        if not _item_matches_browse_filters(item, gender=gender, category=category, words=words):
            continue
        fid = item.get("family_id") or item.get("product_id", "")
        if not fid:
            continue
        groups[fid].append(item)

    summaries = _summaries_from_item_groups(groups)
    for summary in summaries:
        # Stable key for React lists — unique per family within this filter slice
        scope = "|".join(
            [
                (gender or "").upper(),
                category or "",
                summary["family_id"],
            ]
        )
        summary["family_key"] = scope
    return summaries


def build_family_detail(
    catalog: list[dict],
    *,
    family_id: str,
    gender: str,
    category: str,
) -> dict[str, Any] | None:
    """Full variant/view tree for a product family."""
    gender_u = gender.upper()
    items = [
        p
        for p in catalog
        if p.get("family_id") == family_id
        and p.get("gender", "").upper() == gender_u
        and p.get("category") == category
    ]
    if not items:
        return None

    rep = items[0]
    by_variant: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        v = item.get("look_variant") or "00"
        by_variant[v].append(item)

    variant_payloads: list[dict] = []
    for variant in sorted(by_variant.keys()):
        views_sorted = sorted(by_variant[variant], key=lambda x: x.get("image_view", ""))
        variant_payloads.append(
            {
                "variant": variant,
                "views": [
                    {
                        "view": v.get("image_view", "front"),
                        "product_id": v.get("product_id", ""),
                        "image_url": v.get("image_url", ""),
                        "price": v.get("price", 0),
                    }
                    for v in views_sorted
                ],
            }
        )

    return {
        "family_id": family_id,
        "gender": rep.get("gender", ""),
        "category": rep.get("category", ""),
        "product_name": rep.get("product_name", ""),
        "description": rep.get("description", ""),
        "variants": variant_payloads,
    }


def public_item(item: dict) -> dict:
    return {k: v for k, v in item.items() if k != "image_path"}
