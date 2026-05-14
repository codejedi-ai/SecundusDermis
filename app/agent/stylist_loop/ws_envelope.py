"""
Canonical Socket.IO payload for stylist agent → Secundus Dermis → patron (``sd.stylist.v1``).

All patron-targeted real-time pushes from the ReAct loop use a single event name
``sd_stylist_message`` whose JSON body matches this schema. The backend may validate
before relaying; the browser applies ``action`` + ``payload``.
"""

from __future__ import annotations

from typing import Any, Optional

SD_STYLIST_MSG_SCHEMA = "sd.stylist.v1"

STYLIST_WS_ACTIONS = frozenset(
    {
        "shop_sync",
        "catalog_results",
        "found_products",
        "stylist_reply",
        "ui_action",
    }
)


def build_stylist_ws_message(
    *,
    session_id: str,
    action: str,
    payload: dict[str, Any],
    source: str = "tool",
    tool: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Build a ``sd.stylist.v1`` envelope (``session_id`` must match the patron Socket.IO room)."""
    return {
        "schema": SD_STYLIST_MSG_SCHEMA,
        "session_id": (session_id or "").strip(),
        "source": source,
        "tool": tool,
        "action": action,
        "payload": dict(payload or {}),
        "meta": dict(meta) if meta else {},
    }


def build_shop_sync_envelope(
    session_id: str,
    shop_payload: dict[str, Any],
    *,
    source: str = "tool",
    tool: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return build_stylist_ws_message(
        session_id=session_id,
        action="shop_sync",
        payload=dict(shop_payload),
        source=source,
        tool=tool,
        meta=meta,
    )


def build_catalog_results_envelope(
    session_id: str,
    products: list[dict[str, Any]],
    mode: str,
    *,
    source: str = "agent_reply",
    tool: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return build_stylist_ws_message(
        session_id=session_id,
        action="catalog_results",
        payload={"products": products, "mode": mode},
        source=source,
        tool=tool,
        meta=meta,
    )


def build_found_products_envelope(
    session_id: str,
    *,
    content: str,
    products: list[dict[str, Any]],
    tool: str = "show_product",
    meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return build_stylist_ws_message(
        session_id=session_id,
        action="found_products",
        payload={
            "content": content,
            "products": products,
            "count": len(products),
        },
        source="tool",
        tool=tool,
        meta=meta,
    )


def build_stylist_reply_envelope(
    session_id: str,
    *,
    reply: str,
    products: list[dict[str, Any]],
    intent: str,
    filter_: dict[str, Any],
    meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return build_stylist_ws_message(
        session_id=session_id,
        action="stylist_reply",
        payload={
            "reply": reply,
            "products": products,
            "intent": intent,
            "filter": dict(filter_ or {}),
        },
        source="agent_reply",
        tool=None,
        meta=meta,
    )


def validate_stylist_ws_message(data: Any) -> tuple[bool, str, dict[str, Any]]:
    """
    Validate an incoming envelope. Returns ``(ok, error_message, normalized_dict)``.
    On failure ``normalized_dict`` is empty.
    """
    if not isinstance(data, dict):
        return False, "envelope must be a JSON object", {}
    if data.get("schema") != SD_STYLIST_MSG_SCHEMA:
        return False, f"unsupported schema (expected {SD_STYLIST_MSG_SCHEMA!r})", {}
    sid = str(data.get("session_id") or "").strip()
    if not sid:
        return False, "session_id is required", {}
    action = str(data.get("action") or "").strip()
    if action not in STYLIST_WS_ACTIONS:
        return False, f"action not allowed: {action!r}", {}
    payload = data.get("payload")
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        return False, "payload must be an object", {}
    source = str(data.get("source") or "tool").strip() or "tool"
    tool = data.get("tool")
    if tool is not None and not isinstance(tool, str):
        return False, "tool must be a string or null", {}
    meta = data.get("meta") or {}
    if not isinstance(meta, dict):
        return False, "meta must be an object", {}
    normalized = build_stylist_ws_message(
        session_id=sid,
        action=action,
        payload=payload,
        source=source,
        tool=str(tool).strip() if isinstance(tool, str) and tool.strip() else None,
        meta=meta,
    )
    return True, "", normalized
