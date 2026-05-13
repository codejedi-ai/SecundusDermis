"""
In-process implementation of :class:`stylist_loop.deps.StylistAgentDeps` for the FastAPI app.

Keeps catalog, Chroma RAG, and Socket.IO on the backend while the stylist loop lives under ``app/agent/stylist_loop``.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import config
from google.genai import types as genai_types

from shop_tools import keyword_search as kw_catalog
from shop_tools import manage_sidebar as ms_impl

from stylist_loop.payloads import shop_sync_payload

logger = logging.getLogger(__name__)


class InProcessStylistDeps:
    """Binds the ReAct loop to in-memory catalog, Chroma RAG, and the API Socket.IO server."""

    def __init__(self, sio: Any, app_state: Any) -> None:
        self._sio = sio
        self._state = app_state

    async def emit_shop_sync(self, ws_session_id: Optional[str], shop_state: dict[str, Any]) -> None:
        if not ws_session_id:
            return
        await self._sio.emit("shop_sync", shop_sync_payload(shop_state), room=f"sd_{ws_session_id}")

    async def emit_catalog_results(
        self, ws_session_id: Optional[str], products: list[dict[str, Any]], mode: str
    ) -> None:
        if not ws_session_id:
            return
        room = f"sd_{ws_session_id}"
        await self._sio.emit("catalog_results", {"products": products, "mode": mode}, room=room)

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
        from vector_store import get_vector_store

        vs = get_vector_store()
        rag_context = ""
        try:
            embed_contents: list[Any] = [message]
            if image_bytes:
                embed_contents = [
                    genai_types.Content(
                        parts=[
                            genai_types.Part(text=message),
                            genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        ]
                    )
                ]

            res = self._state.gemini.models.embed_content(
                model=config.EMBED_MODEL,
                contents=embed_contents,
                config=genai_types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
            )
            query_embedding = res.embeddings[0].values

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
