"""
Patron shop UI selection — keyed by authenticated ``session_id``.

In-memory for the API process lifetime; mirrors the React ``ShopProvider``
(gender, category, query, search bar text, sidebar width).
"""

from __future__ import annotations

from typing import Any

_DEFAULT: dict[str, Any] = {
    "gender": "",
    "category": "",
    "query": "",
    "input_value": "",
    "sidebar_width": 220,
}

_store: dict[str, dict[str, Any]] = {}


def get_selection(session_id: str) -> dict[str, Any]:
    if not (session_id or "").strip():
        return {}
    sid = session_id.strip()
    if sid not in _store:
        return {}
    merged = {**_DEFAULT, **_store[sid]}
    return {k: merged[k] for k in _DEFAULT}


def put_selection(session_id: str, body: dict[str, Any]) -> dict[str, Any]:
    sid = (session_id or "").strip()
    if not sid:
        return {}
    cur = {**_DEFAULT, **(_store.get(sid) or {})}
    for key in _DEFAULT:
        if key in body and body[key] is not None:
            cur[key] = body[key]
    if "sidebar_width" in cur:
        try:
            w = int(cur["sidebar_width"])
            cur["sidebar_width"] = max(160, min(480, w))
        except (TypeError, ValueError):
            cur["sidebar_width"] = _DEFAULT["sidebar_width"]
    for k in ("gender", "category", "query", "input_value"):
        if k in cur and isinstance(cur[k], str):
            cur[k] = cur[k].strip()
    _store[sid] = cur
    return get_selection(sid)
