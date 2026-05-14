"""StylistAgentDeps over HTTP to the backend /internal/agent/* routes."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

import httpx

from stylist_loop.payloads import shop_sync_payload
from stylist_loop.ws_envelope import (
    build_catalog_results_envelope,
    build_shop_sync_envelope,
    validate_stylist_ws_message,
)
from secundus_agent.sd_socket_client import SdSocketEmitter

logger = logging.getLogger(__name__)


class _ShopContextCompat:
    """Minimal object with ``model_dump()`` for :func:`stylist_loop.stream_loop.gemini_chat_stream`."""

    def __init__(self, data: Optional[dict[str, Any]]) -> None:
        self._data = dict(data or {})

    def model_dump(self) -> dict[str, Any]:
        return dict(self._data)


class RemoteStylistDeps:
    """Calls the API process for catalog, sidebar, RAG, and patron-room fan-out (HTTP and/or Socket.IO)."""

    def __init__(
        self,
        backend_base: str,
        secret: str,
        session_id: str,
        *,
        socket_emitter: Optional[SdSocketEmitter] = None,
    ) -> None:
        self._base = backend_base.rstrip("/")
        self._secret = secret
        self._session_id = session_id
        self._headers = {"X-Agent-Secret": secret}
        self._http = httpx.Client(base_url=self._base, headers=self._headers, timeout=120.0)
        self._socket_emitter = socket_emitter

    def close(self) -> None:
        self._http.close()
        if self._socket_emitter is not None:
            try:
                self._socket_emitter.close()
            except Exception:
                pass

    def _post_json(self, path: str, json: dict[str, Any]) -> dict[str, Any]:
        r = self._http.post(path, json=json)
        r.raise_for_status()
        return r.json()

    async def emit_shop_sync(
        self,
        ws_session_id: Optional[str],
        shop_state: dict[str, Any],
        *,
        source: str = "tool",
        tool: Optional[str] = None,
    ) -> None:
        sid = str(ws_session_id or self._session_id or "").strip()
        if not sid:
            return
        env = build_shop_sync_envelope(
            sid,
            shop_sync_payload(shop_state),
            source=source,
            tool=tool,
        )
        await self.emit_stylist_ws(sid, env)

    async def emit_catalog_results(
        self,
        ws_session_id: Optional[str],
        products: list[dict[str, Any]],
        mode: str,
        *,
        source: str = "agent_reply",
        tool: Optional[str] = None,
    ) -> None:
        sid = str(ws_session_id or self._session_id or "").strip()
        if not sid:
            return
        env = build_catalog_results_envelope(
            sid,
            products,
            mode,
            source=source,
            tool=tool,
        )
        await self.emit_stylist_ws(sid, env)

    async def emit_stylist_ws(self, ws_session_id: Optional[str], envelope: dict[str, Any]) -> None:
        sid = str(ws_session_id or self._session_id or "").strip()
        if not sid:
            return
        ok, err, norm = validate_stylist_ws_message(envelope)
        if not ok:
            logger.warning("[emit_stylist_ws] invalid envelope: %s", err)
            return
        if norm.get("session_id") != sid:
            logger.warning("[emit_stylist_ws] session_id mismatch")
            return
        if self._socket_emitter is not None:
            await asyncio.to_thread(self._socket_emitter.emit_to_patron_room, sid, "sd_stylist_message", norm)
            return
        payload = {"session_id": sid, "event": "sd_stylist_message", "data": norm}
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

    async def websocket_channel(
        self,
        host: str,
        content: dict[str, Any],
        port: Optional[int] = None,
        agent_secret: Optional[str] = None,
    ) -> dict[str, Any]:
        from stylist_loop.ws_tool import (
            pick_effective_secret,
            resolve_socket_origin,
            websocket_channel_sync,
            websocket_host_allowed,
        )

        ok, secret = pick_effective_secret(agent_secret, self._secret)
        if not ok:
            return {"status": "error", "error": "agent_secret does not match configured AGENT_INTERNAL_SECRET"}
        if not secret:
            return {"status": "error", "error": "AGENT_INTERNAL_SECRET missing on agent process"}
        if not str(host).strip():
            return {"status": "error", "error": "host is required (IP or hostname of the Secundus API)"}
        if not websocket_host_allowed(host, self._base):
            return {
                "status": "error",
                "error": "host not permitted; use the same host as BACKEND_URL or set SD_WEBSOCKET_ALLOWED_HOSTS",
            }

        raw = dict(content or {})
        mode = str(raw.get("mode") or raw.get("target") or "").strip().lower()
        mode = {
            "patron_room": "patron_emit",
            "emit_patron": "patron_emit",
            "to_patron": "patron_emit",
        }.get(mode, mode)
        raw = {**raw, "mode": mode}

        if mode in ("broadcast_agents", "socket_to_agents", "to_agents"):
            body = {
                "event": str(raw.get("event") or "sd_bridge").strip() or "sd_bridge",
                "data": raw["data"] if isinstance(raw.get("data"), dict) else {},
            }

            def _post() -> dict[str, Any]:
                return self._post_json("/internal/agent/socket-to-agents", body)

            try:
                out = await asyncio.to_thread(_post)
                return {"status": "ok", "mode": mode, **out}
            except Exception as exc:
                logger.warning("[websocket tool] HTTP socket-to-agents failed: %s", exc)
                return {"status": "error", "error": str(exc)}

        if mode == "patron_emit" and not str(raw.get("session_id") or "").strip():
            raw = {**raw, "session_id": self._session_id}

        origin = resolve_socket_origin(host, port, self._base)

        def _sock() -> dict[str, Any]:
            return websocket_channel_sync(origin, secret, raw)

        return await asyncio.to_thread(_sock)
