"""
Catalog keyword search + shop sidebar state (pure functions).
Used by the API, internal agent-bridge routes, and the stylist ReAct loop.
"""

from __future__ import annotations

import re
from typing import Any, Optional

# ── Shop sidebar taxonomy (keep in sync with frontend/src/components/ShopSidebar.tsx) ─

_SIDEBAR_GROUPS_MEN = [
    {"label": "Tops", "cats": ["Tees_Tanks", "Shirts_Polos", "Sweaters", "Sweatshirts_Hoodies", "Suiting"]},
    {"label": "Bottoms", "cats": ["Denim", "Pants", "Shorts"]},
    {"label": "Layers", "cats": ["Jackets_Vests"]},
]
_SIDEBAR_GROUPS_WOMEN = [
    {"label": "Tops", "cats": ["Tees_Tanks", "Graphic_Tees", "Blouses_Shirts", "Cardigans"]},
    {"label": "Bottoms", "cats": ["Denim", "Pants", "Shorts", "Skirts", "Leggings"]},
    {"label": "Dresses & Sets", "cats": ["Dresses", "Rompers_Jumpsuits"]},
    {"label": "Layers", "cats": ["Jackets_Coats"]},
]
_SIDEBAR_GROUPS_ALL = [
    {"label": "Tops", "cats": ["Tees_Tanks", "Graphic_Tees", "Blouses_Shirts", "Shirts_Polos", "Sweaters", "Sweatshirts_Hoodies", "Cardigans", "Suiting"]},
    {"label": "Bottoms", "cats": ["Denim", "Pants", "Shorts", "Skirts", "Leggings"]},
    {"label": "Dresses & Sets", "cats": ["Dresses", "Rompers_Jumpsuits"]},
    {"label": "Layers", "cats": ["Jackets_Vests", "Jackets_Coats"]},
]

ALL_VALID_CATEGORIES = frozenset(c for g in _SIDEBAR_GROUPS_ALL for c in g["cats"])


def _sidebar_groups_for_gender(gender: Optional[str]) -> list[dict]:
    if gender == "MEN":
        return _SIDEBAR_GROUPS_MEN
    if gender == "WOMEN":
        return _SIDEBAR_GROUPS_WOMEN
    return _SIDEBAR_GROUPS_ALL


def _normalize_gender_arg(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    u = str(raw).strip().upper()
    if u in ("MEN", "MAN", "MENS", "MEN'S"):
        return "MEN"
    if u in ("WOMEN", "WOMAN", "WOMENS", "WOMEN'S"):
        return "WOMEN"
    return None


def _normalize_category_arg(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    s = str(raw).strip().replace(" ", "_")
    if not s:
        return None
    for c in ALL_VALID_CATEGORIES:
        if c.lower() == s.lower():
            return c
    return None


def build_sidebar_snapshot(shop_state: dict) -> dict[str, Any]:
    """Full sidebar tree: every gender and category with selected / not selected (matches Shop UI)."""
    g_sel = _normalize_gender_arg(shop_state.get("gender"))
    c_sel = _normalize_category_arg(shop_state.get("category"))

    genders = [
        {"id": "MEN", "label": "Men", "selected": g_sel == "MEN"},
        {"id": "WOMEN", "label": "Women", "selected": g_sel == "WOMEN"},
    ]
    groups_out: list[dict[str, Any]] = []
    for grp in _sidebar_groups_for_gender(g_sel):
        cats = [
            {
                "id": cid,
                "label": cid.replace("_", " "),
                "selected": c_sel == cid,
            }
            for cid in grp["cats"]
        ]
        groups_out.append({"label": grp["label"], "categories": cats})

    sel_g_label = next((x["label"] for x in genders if x["selected"]), None)
    sel_c_label = None
    for grp in groups_out:
        for cat in grp["categories"]:
            if cat["selected"]:
                sel_c_label = cat["label"]
                break
        if sel_c_label:
            break

    return {
        "genders": genders,
        "category_groups": groups_out,
        "selected_gender_id": g_sel,
        "selected_category_id": c_sel,
        "narration": (
            f"Currently selected: gender={sel_g_label or 'none (all)'}, category={sel_c_label or 'none'}."
            " Every other option above is not selected."
        ),
    }


def _apply_sidebar_selection(
    shop_state: dict,
    action: Optional[str],
    args: dict[str, Any],
) -> tuple[bool, str]:
    """
    Mutates shop_state keys gender, category. Returns (changed, reason_note).
    """
    if not action or str(action).strip().lower() not in ("select", "set"):
        return False, ""

    args = args or {}
    changed = False
    current_g = _normalize_gender_arg(shop_state.get("gender"))
    current_c = _normalize_category_arg(shop_state.get("category"))

    has_g = "gender" in args
    has_c = "category" in args
    legacy_value = args.get("value")

    if has_g:
        g_raw = args["gender"]
        if g_raw is None or str(g_raw).strip().upper() in ("ALL", "NONE", ""):
            if current_g is not None or current_c is not None:
                changed = True
            current_g = None
            current_c = None
        else:
            ng = _normalize_gender_arg(str(g_raw))
            if ng:
                if current_g != ng:
                    changed = True
                current_g = ng
                if not has_c:
                    if current_c is not None:
                        changed = True
                    current_c = None

    if has_c:
        c_raw = args["category"]
        if c_raw is None or str(c_raw).strip() == "":
            if current_c is not None:
                changed = True
            current_c = None
        else:
            nc = _normalize_category_arg(str(c_raw))
            if nc and current_c != nc:
                changed = True
                current_c = nc
            elif nc is None:
                pass

    if not has_g and not has_c and legacy_value:
        v = str(legacy_value).strip()
        vu = v.upper()
        if vu in ("MEN", "WOMEN"):
            ng = vu
            if current_g != ng or current_c is not None:
                changed = True
            current_g = ng
            current_c = None
        elif vu in ("ALL", "NONE"):
            if current_g is not None or current_c is not None:
                changed = True
            current_g = None
            current_c = None
        else:
            nc = _normalize_category_arg(v)
            if nc and current_c != nc:
                changed = True
                current_c = nc

    shop_state["gender"] = current_g
    shop_state["category"] = current_c
    return changed, "sidebar_updated" if changed else ""


def manage_sidebar(
    action: Optional[str] = None,
    value: Optional[str] = None,
    gender: Optional[str] = None,
    category: Optional[str] = None,
    shop_state: Optional[dict] = None,
) -> dict[str, Any]:
    """
    Observe or update the shop sidebar (gender + secondary category), aligned with the React sidebar.
    Pass shop_state dict (mutable); receives full tree with selected / unselected for every option.
    """
    if shop_state is None:
        shop_state = {}

    args: dict[str, Any] = {}
    if gender is not None:
        args["gender"] = gender
    if category is not None:
        args["category"] = category
    if value is not None:
        args["value"] = value

    act = (action or "").strip().lower() if action else ""
    if act in ("", "observe", "peek", "read", "list"):
        snap = build_sidebar_snapshot(shop_state)
        return {
            "mode": "observe",
            "shop_sidebar": snap,
            "ui_action_required": False,
            "action_payload": None,
            "status": "Observation: full sidebar (all options with selected flags).",
        }

    changed, _ = _apply_sidebar_selection(shop_state, action, args)
    snap = build_sidebar_snapshot(shop_state)

    payload = {
        "gender": shop_state.get("gender") or "",
        "category": shop_state.get("category") or "",
    }

    return {
        "mode": "select",
        "shop_sidebar": snap,
        "ui_action_required": changed,
        "action_payload": payload if changed else None,
        "status": "Sidebar updated." if changed else "No change (values already active).",
    }


def keyword_search(
    catalog: list[dict],
    keywords: str,
    gender: Optional[str] = None,
    category: Optional[str] = None,
    n_results: int = 8,
) -> list[dict]:
    """Search catalog by keywords - matches ANY word from the query."""
    kw = keywords.lower().strip()
    if not kw:
        return []

    search_terms = [t.strip() for t in re.split(r"[\s,]+", kw) if len(t.strip()) > 2]

    results = []
    for item in catalog:
        desc_lower = item.get("description", "").lower()
        name_lower = item.get("product_name", "").lower()
        cat_lower = item.get("category", "").lower()

        if search_terms:
            matches = any(
                term in desc_lower or term in name_lower or term in cat_lower for term in search_terms
            )
            if not matches:
                continue

        if gender and item.get("gender", "").upper() != gender.upper():
            continue
        if category and item.get("category", "") != category:
            continue

        results.append({k: v for k, v in item.items() if k != "image_path"})
        if len(results) >= n_results:
            break

    return results
