"""Dependency injection for the stylist ReAct loop (in-process API vs remote agent)."""

from __future__ import annotations

from typing import Any, Optional, Protocol, runtime_checkable


@runtime_checkable
class StylistAgentDeps(Protocol):
    """Backend capabilities the stylist loop needs — implemented in-process or via HTTP/WebSocket."""

    async def emit_shop_sync(self, ws_session_id: Optional[str], shop_state: dict[str, Any]) -> None: ...

    async def emit_catalog_results(
        self, ws_session_id: Optional[str], products: list[dict[str, Any]], mode: str
    ) -> None: ...

    def keyword_search(
        self,
        keywords: str,
        gender: Optional[str] = None,
        category: Optional[str] = None,
        n_results: int = 8,
    ) -> list[dict[str, Any]]: ...

    def manage_sidebar(
        self,
        action: Optional[str],
        value: Optional[str],
        gender: Optional[str],
        category: Optional[str],
        shop_state: dict[str, Any],
    ) -> dict[str, Any]: ...

    def find_catalog_product(self, product_id: str) -> Optional[dict[str, Any]]: ...

    async def build_initial_rag_context(
        self,
        message: str,
        image_bytes: Optional[bytes],
        mime_type: str,
        ws_session_id: Optional[str],
    ) -> str: ...
