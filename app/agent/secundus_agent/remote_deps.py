"""StylistAgentDeps over HTTP to the backend /internal/agent/* routes."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

import httpx

from stylist_loop.payloads import shop_sync_payload

logger = logging.getLogger(__name__)


class _ShopContextCompat:
    """Minimal object with ``model_dump()`` for :func:`stylist_loop.stream_loop.gemini_chat_stream`."""

    def __init__(self, data: Optional[dict[str, Any]]) -> None:
        self._data = dict(data or {})

    def model_dump(self) -> dict[str, Any]:
        return dict(self._data)


class RemoteStylistDeps:
    """Calls the API process for catalog, sidebar, RAG, and Socket.IO fan-out (blocking HTTP)."""

    def __init__(self, backend_base: str, secret: str, session_id: str) -> None:
        self._base = backend_base.rstrip("/")
        self._secret = secret
        self._session_id = session_id
        self._headers = {"X-Agent-Secret": secret}
        self._http = httpx.Client(base_url=self._base, headers=self._headers, timeout=120.0)

    def close(self) -> None:
        self._http.close()

    def _post_json(self, path: str, json: dict[str, Any]) -> dict[str, Any]:
        r = self._http.post(path, json=json)
        r.raise_for_status()
        return r.json()

    async def emit_shop_sync(self, ws_session_id: Optional[str], shop_state: dict[str, Any]) -> None:
        sid = ws_session_id or self._session_id
        payload = {"session_id": sid, "event": "shop_sync", "data": shop_sync_payload(shop_state)}
        await asyncio.to_thread(self._post_json, "/internal/agent/emit", payload)

    async def emit_catalog_results(
        self, ws_session_id: Optional[str], products: list[dict[str, Any]], mode: str
    ) -> None:
        sid = ws_session_id or self._session_id
        payload = {
            "session_id": sid,
            "event": "catalog_results",
            "data": {"products": products, "mode": mode},
        }
        await asyncio.to_thread(self._post_json, "/internal/agent/emit", payload)

    def keyword_search(
        self,
        keywords: str,
        gender: Optional[str] = None,
        category: Optional[str] = None,
        n_results: int = 8,
    ) -> list[dict[str, Any]]:
        data = self._post_json(
            "/internal/agent/keyword-search",
            {"keywords": keywords, "gender": gender, "category": category, "n_results": n_results},
        )
        return list(data.get("products") or [])

    def manage_sidebar(
        self,
        action: Optional[str],
        value: Optional[str],
        gender: Optional[str],
        category: Optional[str],
        shop_state: dict[str, Any],
    ) -> dict[str, Any]:
        data = self._post_json(
            "/internal/agent/manage-sidebar",
            {
                "shop_state": dict(shop_state),
                "action": action,
                "value": value,
                "gender": gender,
                "category": category,
            },
        )
        obs = data.get("observation") or {}
        new_state = data.get("shop_state")
        if isinstance(new_state, dict):
            shop_state.clear()
            shop_state.update(new_state)
        return obs

    def find_catalog_product(self, product_id: str) -> Optional[dict[str, Any]]:
        data = self._post_json("/internal/agent/show-product", {"product_id": product_id})
        return data.get("product")

    async def build_initial_rag_context(
        self,
        message: str,
        image_bytes: Optional[bytes],
        mime_type: str,
        ws_session_id: Optional[str],
    ) -> str:
        import base64

        body: dict[str, Any] = {
            "message": message,
            "session_id": ws_session_id or self._session_id,
            "mime_type": mime_type,
            "image_base64": base64.b64encode(image_bytes).decode("ascii") if image_bytes else None,
        }

        def _call() -> dict[str, Any]:
            return self._post_json("/internal/agent/rag-context", body)

        data = await asyncio.to_thread(_call)
        return str(data.get("rag_context") or "")
