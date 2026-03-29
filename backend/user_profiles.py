"""
Patron profile store for Secundus Dermis.

Keyed by user email. In-memory for the lifetime of the process.
Stores AI-extracted style insights, cart history, and a full browser
activity log so the AI can observe patron behaviour and personalise
responses accordingly.
"""

from __future__ import annotations
import time

_profiles: dict[str, dict] = {}


def _default(email: str) -> dict:
    return {
        "email": email,
        "notes": [],        # AI-extracted style/preference insights (strings)
        "cart_items": [],   # {product_id, product_name, description, category}
        "activity": [],     # {event, path, label, seconds, ts} — full browser log
    }


def get_profile(email: str) -> dict:
    return dict(_profiles.get(email, _default(email)))


# ── Style notes ───────────────────────────────────────────────────────────────

def add_note(email: str, note: str) -> None:
    """Append a preference insight. Ignores duplicates. Caps at 20."""
    p = _profiles.setdefault(email, _default(email))
    note = note.strip()
    if note and note not in p["notes"]:
        p["notes"].append(note)
        if len(p["notes"]) > 20:
            p["notes"] = p["notes"][-20:]


# ── Cart history ──────────────────────────────────────────────────────────────

def add_cart_item(
    email: str,
    product_id: str,
    product_name: str,
    description: str,
    category: str,
) -> None:
    """Record a piece the patron has reserved (added to cart)."""
    p = _profiles.setdefault(email, _default(email))
    existing = {c["product_id"] for c in p["cart_items"]}
    if product_id not in existing:
        p["cart_items"].append({
            "product_id": product_id,
            "product_name": product_name,
            "description": description,
            "category": category,
        })


# ── Activity log ──────────────────────────────────────────────────────────────

def record_activity(
    email: str,
    event: str,
    path: str = "",
    label: str = "",
    seconds: int = 0,
) -> None:
    """
    Append a browser activity entry.

    event types:
      "page_view"    — patron visited a page
      "product_view" — patron viewed a product (path=/product/id, label=product_name)
      "page_dwell"   — patron lingered on a page for `seconds` seconds
      "search"       — patron submitted a search query (label=query)
      "cart_add"     — patron added a piece to their portfolio
      "cart_remove"  — patron removed a piece from their portfolio
    """
    p = _profiles.setdefault(email, _default(email))
    p["activity"].append({
        "event":   event,
        "path":    path,
        "label":   label,
        "seconds": seconds,
        "ts":      int(time.time()),
    })
    # Keep last 50 events
    if len(p["activity"]) > 50:
        p["activity"] = p["activity"][-50:]
