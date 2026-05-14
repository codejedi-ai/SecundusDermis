"""
In-process implementation of :class:`stylist_loop.deps.StylistAgentDeps` for the FastAPI app.

Keeps catalog, Chroma RAG, and Socket.IO on the backend. Query embeddings are obtained from the
standalone agent over HTTP (``GEMINI_API_KEY`` is not used on the backend).
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
from typing import Any, Optional

import httpx

from shop_tools import keyword_search as kw_catalog
from shop_tools import manage_sidebar as ms_impl

from stylist_loop.payloads import shop_sync_payload
from stylist_loop.ws_envelope import (
    build_catalog_results_envelope,
    build_shop_sync_envelope,
    validate_stylist_ws_message,
)

logger = logging.getLogger(__name__)


class InProcessStylistDeps:
    """Binds the ReAct loop to in-memory catalog, Chroma RAG, and the API Socket.IO server."""

    def __init__(
        self,
        sio: Any,
        app_state: Any,
        *,
        agent_http: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self._sio = sio
        self._state = app_state
        self._agent_http = agent_http

    async def emit_shop_sync(
        self,
        ws_session_id: Optional[str],
        shop_state: dict[str, Any],
        *,
        source: str = "tool",
        tool: Optional[str] = None,
    ) -> None:
        if not ws_session_id:
            return
        sid = str(ws_session_id).strip()
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
        if not ws_session_id:
            return
        sid = str(ws_session_id).strip()
        env = build_catalog_results_envelope(sid, products, mode, source=source, tool=tool)
        await self.emit_stylist_ws(sid, env)

    async def emit_stylist_ws(self, ws_session_id: Optional[str], envelope: dict[str, Any]) -> None:
        if not ws_session_id:
            return
        sid = str(ws_session_id).strip()
        ok, err, norm = validate_stylist_ws_message(envelope)
        if not ok:
            logger.warning("[emit_stylist_ws] invalid envelope: %s", err)
            return
        if norm.get("session_id") != sid:
            logger.warning("[emit_stylist_ws] session_id mismatch")
            return
        await self._sio.emit("sd_stylist_message", norm, room=f"sd_{sid}")

    def keyword_search(
        self,
        keywords: str,
        gender: Optional[str] = None,
        category: Optional[str] = None,
        n_results: int = 8,
    ) -> list[dict[str, Any]]:
        return kw_catalog(self._state.catalog, keywords, gender=gender, category=category, n_results=n_results)

    def manage_sidebar(
        self,
        action: Optional[str],
        value: Optional[str],
        gender: Optional[str],
        category: Optional[str],
        shop_state: dict[str, Any],
    ) -> dict[str, Any]:
        return ms_impl(action, value, gender, category, shop_state=shop_state)

    def find_catalog_product(self, product_id: str) -> Optional[dict[str, Any]]:
        for p in self._state.catalog:
            if p.get("product_id") == product_id:
                return p
        return None

    async def build_initial_rag_context(
        self,
        message: str,
        image_bytes: Optional[bytes],
        mime_type: str,
        ws_session_id: Optional[str],
    ) -> str:
        from agent_ai_client import embed_query
        from vector_store import get_vector_store

        if self._agent_http is None:
            logger.warning("RAG context skipped: no agent HTTP client (set AGENT_SERVICE_URL).")
            return ""

        vs = get_vector_store()
        rag_context = ""
        try:
            img_b64 = base64.b64encode(image_bytes).decode("ascii") if image_bytes else None
            query_embedding = await embed_query(
                self._agent_http,
                message,
                img_b64,
                mime_type or "image/jpeg",
            )

            vs.add_query_embedding(message, query_embedding, session_id=ws_session_id or "default")

            journal_hits = vs.search_journal(query_embedding, limit=2)
            if journal_hits:
                rag_context += "\n\n## Journal Context\n" + "\n".join(
                    [f"- {h['metadata']['title']}: {h['metadata']['excerpt']}" for h in journal_hits]
                )

            img_memory = vs.search_images_by_similarity(query_embedding, limit=2)
            if img_memory:
                rag_context += "\n\n## Visual Memory\n" + "\n".join(
                    [f"- Past visual: {h['metadata']['description']}" for h in img_memory]
                )

        except Exception as e:
            logger.warning("Initial RAG failed: %s", e)

        return rag_context

    async def websocket_channel(
        self,
        host: str,
        content: dict[str, Any],
        port: Optional[int] = None,
        agent_secret: Optional[str] = None,
    ) -> dict[str, Any]:
        import config as cfg
        from agent_socket_bridge import emit_to_agent_connections
        from stylist_loop.ws_tool import (
            pick_effective_secret,
            resolve_socket_origin,
            websocket_channel_sync,
            websocket_host_allowed,
        )

        backend_url = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
        secret = (cfg.AGENT_INTERNAL_SECRET or "").strip()
        ok, eff = pick_effective_secret(agent_secret, secret)
        if not ok:
            return {"status": "error", "error": "agent_secret does not match configured AGENT_INTERNAL_SECRET"}
        if not eff:
            return {"status": "error", "error": "AGENT_INTERNAL_SECRET not set on API"}
        if not str(host).strip():
            return {"status": "error", "error": "host is required (IP or hostname of the Secundus API)"}
        if not websocket_host_allowed(host, backend_url):
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
            ev = str(raw.get("event") or "sd_bridge").strip() or "sd_bridge"
            data = raw["data"] if isinstance(raw.get("data"), dict) else {}
            await emit_to_agent_connections(self._sio, ev, data)
            return {"status": "ok", "mode": mode, "room": "sd_agent_service"}

        if mode == "patron_emit":
            sid = str(raw.get("session_id") or "").strip()
            event = str(raw.get("event") or "").strip()
            data = raw.get("data") if isinstance(raw.get("data"), dict) else {}
            if not sid or not event:
                return {"status": "error", "error": "patron_emit requires session_id and event"}
            await self._sio.emit(event, data, room=f"sd_{sid}")
            return {"status": "ok", "mode": mode, "room": f"sd_{sid}"}

        origin = resolve_socket_origin(host, port, backend_url)
        return await asyncio.to_thread(websocket_channel_sync, origin, eff, raw)
