"""Shared payloads for Socket.IO shop sync and patron → agent shop state."""

from __future__ import annotations

from typing import Any


def merge_patron_shop_context(shop_context: Any) -> dict[str, Any]:
    """
    Initialise the agent loop ``shop_state`` from optional patron UI snapshot (HTTP ``shop_context``).

    Contract (Suite A — frontend → backend): values mirror ChatWidget / ``chatStream`` payload.
    """
    shop_state: dict[str, Any] = {"gender": None, "category": None, "query": None}
    if shop_context is None:
        return shop_state
    dumped = shop_context.model_dump() if hasattr(shop_context, "model_dump") else dict(shop_context or {})
    shop_state["gender"] = dumped.get("gender") or None
    shop_state["category"] = dumped.get("category") or None
    shop_state["query"] = dumped.get("query") or None
    if isinstance(shop_state["gender"], str) and not shop_state["gender"].strip():
        shop_state["gender"] = None
    if isinstance(shop_state["category"], str) and not shop_state["category"].strip():
        shop_state["category"] = None
    return shop_state


def shop_sync_payload(shop_state: dict[str, Any]) -> dict[str, str]:
    """JSON-safe gender/category/query for the React ShopProvider."""

    def _norm(v: Any) -> str:
        if v is None:
            return ""
        return str(v).strip()

    return {
        "gender": _norm(shop_state.get("gender")),
        "category": _norm(shop_state.get("category")),
        "query": _norm(shop_state.get("query")),
    }
