"""Suite B — stylist pushes use ``sd_stylist_message`` + ``sd.stylist.v1`` envelope."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from stylist_backend_bridge import InProcessStylistDeps
from stylist_loop.payloads import shop_sync_payload
from stylist_loop.ws_envelope import build_catalog_results_envelope, build_shop_sync_envelope


@pytest.mark.asyncio
async def test_emit_shop_sync_targets_session_room_and_payload():
    sio = AsyncMock()
    state = SimpleNamespace(catalog=[])
    deps = InProcessStylistDeps(sio, state, agent_http=None)

    shop_state = {"gender": "WOMEN", "category": "Dresses", "query": "silk"}
    await deps.emit_shop_sync("sess-abc", shop_state, tool="manage_sidebar")

    env = build_shop_sync_envelope("sess-abc", shop_sync_payload(shop_state), tool="manage_sidebar")
    sio.emit.assert_awaited_once_with("sd_stylist_message", env, room="sd_sess-abc")


@pytest.mark.asyncio
async def test_emit_shop_sync_skips_without_session_id():
    sio = AsyncMock()
    deps = InProcessStylistDeps(sio, SimpleNamespace(catalog=[]), agent_http=None)
    await deps.emit_shop_sync(None, {"gender": "MEN"})
    await deps.emit_shop_sync("", {"gender": "MEN"})
    sio.emit.assert_not_called()


@pytest.mark.asyncio
async def test_emit_catalog_results_targets_session_room():
    sio = AsyncMock()
    deps = InProcessStylistDeps(sio, SimpleNamespace(catalog=[]), agent_http=None)
    products = [{"product_id": "p1", "product_name": "Tee"}]
    await deps.emit_catalog_results("xyz", products, "text_search")

    env = build_catalog_results_envelope("xyz", products, "text_search")
    sio.emit.assert_awaited_once_with("sd_stylist_message", env, room="sd_xyz")
