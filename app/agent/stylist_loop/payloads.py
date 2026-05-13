"""Shared payloads for Socket.IO shop sync."""

from __future__ import annotations

from typing import Any


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
