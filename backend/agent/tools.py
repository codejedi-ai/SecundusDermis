"""
agent/tools.py
==============
Tool functions exposed to the ADK agent.
Call init_tools() once at startup (from api.py lifespan) before the agent runs.

All search is pure Python keyword matching — zero Gemini API calls.
"""

from __future__ import annotations

import contextvars
import logging
from typing import Optional

log = logging.getLogger(__name__)

# ── Module-level state (set by init_tools) ────────────────────────────────────

_catalog: list[dict] = []
_journal: list[dict] = []

# ── Patron context (set per-request via set_patron_context) ───────────────────

_patron_email_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "patron_email", default=None
)


def set_patron_context(email: Optional[str]) -> contextvars.Token:
    """Set the current patron's email for this async context. Returns a reset token."""
    return _patron_email_ctx.set(email)


def init_tools(catalog: list[dict], journal: list[dict] = None, **_kwargs):
    """Inject the in-memory catalog and journal. Called once during FastAPI startup."""
    global _catalog, _journal
    _catalog = catalog
    _journal = journal or []
    log.info(f"agent/tools: catalog injected — {len(_catalog)} items, {len(_journal)} journal entries")


# ── Tools (called by the ADK agent) ──────────────────────────────────────────

def search_by_keywords(
    keywords: str,
    gender: str = None,
    category: str = None,
    max_price: float = None,
    n_results: int = 8,
) -> dict:
    """
    Fast keyword search — zero API cost.
    Scans product descriptions for the given keywords and returns matching
    items instantly.  Use this for all product searches.

    Args:
        keywords:  One or more words to look for in the description,
                   e.g. "floral" or "leather jacket" or "blue cotton shirt".
        gender:    Optional filter — "MEN" or "WOMEN".
        category:  Optional filter — e.g. "Denim", "Dresses", "Tees_Tanks".
        max_price: Optional upper price limit in USD.
        n_results: Number of results to return (default 8, max 32).

    Returns:
        dict with keys "products" (list) and "total" (int).
        Each product has: product_id, product_name, description,
        gender, category, price, image_url.
    """
    try:
        n_results = min(max(1, n_results), 32)
        kw = keywords.lower().strip()

        out = []
        for item in _catalog:
            # keyword filter
            if kw and kw not in item.get("description", "").lower():
                continue
            # gender filter
            if gender and item.get("gender", "").upper() != gender.upper():
                continue
            # category filter
            if category and item.get("category", "") != category:
                continue
            # price filter
            if max_price is not None and item.get("price", 0.0) > max_price:
                continue

            out.append({
                "product_id":   item.get("product_id", ""),
                "product_name": item.get("product_name", ""),
                "description":  item.get("description", ""),
                "gender":       item.get("gender", ""),
                "category":     item.get("category", ""),
                "price":        float(item.get("price", 0.0)),
                "image_url":    item.get("image_url", ""),
            })
            if len(out) >= n_results:
                break

        return {"products": out, "total": len(out), "keywords": keywords}
    except Exception as exc:
        log.error(f"search_by_keywords error: {exc}")
        return {"products": [], "total": 0, "keywords": keywords, "error": str(exc)}


def get_catalog_stats() -> dict:
    """
    Return statistics about the product catalog:
    total item count, available categories, and available genders.
    """
    try:
        cats, genders = set(), set()
        for item in _catalog:
            cats.add(item.get("category", "unknown"))
            genders.add(item.get("gender", "unknown"))
        return {
            "total_products": len(_catalog),
            "categories":     sorted(cats),
            "genders":        sorted(genders),
        }
    except Exception as exc:
        log.error(f"get_catalog_stats error: {exc}")
        return {"total_products": 0, "categories": [], "genders": []}


def search_journal(keywords: str, n_results: int = 3) -> dict:
    """
    Search the Secundus Dermis Journal (blog) for entries matching the given keywords.
    Use this when the customer asks about fashion advice, how-to guides, category
    explanations, or any topic that might be covered in an editorial article.

    Args:
        keywords: Words to search for in journal titles, excerpts, and body text.
        n_results: Number of results to return (default 3, max 5).

    Returns:
        dict with "articles" list. Each article has: slug, title, excerpt, category, date.
    """
    try:
        n_results = min(max(1, n_results), 5)
        kw = keywords.lower().strip()
        out = []
        for post in _journal:
            searchable = f"{post.get('title','')} {post.get('excerpt','')} {post.get('body','')}".lower()
            if kw and kw not in searchable:
                continue
            out.append({
                "slug":     post.get("slug", ""),
                "title":    post.get("title", ""),
                "excerpt":  post.get("excerpt", ""),
                "category": post.get("category", ""),
                "date":     post.get("date", ""),
            })
            if len(out) >= n_results:
                break
        return {"articles": out, "total": len(out), "keywords": keywords}
    except Exception as exc:
        log.error(f"search_journal error: {exc}")
        return {"articles": [], "total": 0, "keywords": keywords, "error": str(exc)}


def get_product_categories() -> dict:
    """
    Return the list of available product categories and genders
    so you know what filters are valid for search_by_keywords.
    """
    stats = get_catalog_stats()
    return {
        "categories": stats["categories"],
        "genders":    stats["genders"],
    }


def get_patron_profile() -> dict:
    """
    Retrieve the current patron's profile: their style notes, reserved pieces
    (cart history), and recent browser activity (pages visited, products viewed,
    searches, dwell times). Call this at the start of any conversation with a
    logged-in patron to personalise your response — address them by name, reference
    pieces they've reserved, and note what they've been browsing.

    Returns a dict with keys:
      email       — patron email
      notes       — list of AI-extracted style insight strings
      cart_items  — list of {product_name, category, description} they've reserved
      activity    — list of recent {event, path, label, seconds} browser actions
    """
    try:
        from user_profiles import get_profile as _get_profile
        email = _patron_email_ctx.get()
        if not email:
            return {"email": None, "notes": [], "cart_items": [], "activity": []}
        return _get_profile(email)
    except Exception as exc:
        log.error(f"get_patron_profile error: {exc}")
        return {"email": None, "notes": [], "cart_items": [], "activity": []}


def save_patron_note(note: str) -> dict:
    """
    Save a concise insight about the patron's style, preferences, or aesthetic
    discovered during conversation or inferred from their browsing behaviour.

    Call this whenever the patron reveals something meaningful:
      - Preferred palette or textures ("gravitates toward earth tones")
      - Silhouette or fit preferences ("prefers relaxed, oversized silhouettes")
      - Occasion dressing ("shops primarily for business-casual environments")
      - Lifestyle signals ("mentioned travelling frequently, values versatility")
      - Fabric preferences ("avoids synthetic textiles, prefers natural fibres")
      - Things they dislike ("not interested in graphic prints")

    Notes are stored and surfaced in future sessions via get_patron_profile.

    Args:
        note: A concise, third-person insight. E.g. "Prefers structured, minimalist pieces."

    Returns:
        {"saved": true} on success.
    """
    try:
        from user_profiles import add_note as _add_note
        email = _patron_email_ctx.get()
        if email and note:
            _add_note(email, note.strip())
        return {"saved": True}
    except Exception as exc:
        log.error(f"save_patron_note error: {exc}")
        return {"saved": False, "error": str(exc)}
