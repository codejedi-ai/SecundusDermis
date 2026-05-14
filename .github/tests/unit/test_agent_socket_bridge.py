"""Regression: backend ↔ agent duplex room and emit helper."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

import agent_socket_bridge
from agent_socket_bridge import (
    AGENT_SERVICE_ROOM,
    count_room_participants,
    emit_to_agent_connections,
    forget_patron_agent_socket,
    replace_patron_agent_socket_exclusive,
)


@pytest.mark.asyncio
async def test_emit_to_agent_connections_targets_service_room():
    sio = AsyncMock()
    await emit_to_agent_connections(sio, "sd_bridge", {"type": "notify", "x": 1})
    sio.emit.assert_awaited_once_with(
        "sd_bridge",
        {"type": "notify", "x": 1},
        room=AGENT_SERVICE_ROOM,
    )


@pytest.mark.asyncio
async def test_emit_to_agent_connections_coerces_none_data():
    sio = AsyncMock()
    await emit_to_agent_connections(sio, "sd_bridge", None)
    sio.emit.assert_awaited_once_with("sd_bridge", {}, room=AGENT_SERVICE_ROOM)


class _MgrEmpty:
    def get_participants(self, namespace, room):
        return iter([])


class _MgrTwo:
    def get_participants(self, namespace, room):
        yield from ("sid-a", "sid-b")


def test_count_room_participants_empty():
    class Sio:
        manager = _MgrEmpty()

    assert count_room_participants(Sio(), AGENT_SERVICE_ROOM) == 0


def test_count_room_participants_two():
    class Sio:
        manager = _MgrTwo()

    assert count_room_participants(Sio(), AGENT_SERVICE_ROOM) == 2


def test_count_room_participants_broken_manager_returns_zero():
    class Sio:
        manager = object()

    assert count_room_participants(Sio(), AGENT_SERVICE_ROOM) == 0


def _reset_patron_registry() -> None:
    agent_socket_bridge._patron_agent_sid_by_key_hash.clear()


@pytest.mark.asyncio
async def test_replace_patron_agent_socket_disconnects_prior_holder():
    _reset_patron_registry()

    class FakeSio:
        def __init__(self) -> None:
            self.disconnected: list[tuple[str, str | None]] = []

        async def disconnect(self, sid, reason=None):
            self.disconnected.append((sid, reason))

    sio = FakeSio()
    await replace_patron_agent_socket_exclusive(sio, "sid-1", "keyhash")
    await replace_patron_agent_socket_exclusive(sio, "sid-2", "keyhash")
    assert len(sio.disconnected) == 1
    assert sio.disconnected[0][0] == "sid-1"
    assert sio.disconnected[0][1] and "superseded" in sio.disconnected[0][1]


@pytest.mark.asyncio
async def test_forget_patron_agent_socket_then_replace_disconnects_current_owner_only():
    _reset_patron_registry()

    class FakeSio:
        def __init__(self) -> None:
            self.disconnected: list[str] = []

        async def disconnect(self, sid, reason=None):
            self.disconnected.append(sid)

    sio = FakeSio()
    await replace_patron_agent_socket_exclusive(sio, "sid-a", "hk")
    await replace_patron_agent_socket_exclusive(sio, "sid-b", "hk")
    assert sio.disconnected == ["sid-a"]
    forget_patron_agent_socket("sid-a")
    await replace_patron_agent_socket_exclusive(sio, "sid-c", "hk")
    assert sio.disconnected == ["sid-a", "sid-b"]


@pytest.mark.asyncio
async def test_forget_owner_allows_fresh_connect_without_disconnect():
    _reset_patron_registry()

    class FakeSio:
        def __init__(self) -> None:
            self.disconnected: list[str] = []

        async def disconnect(self, sid, reason=None):
            self.disconnected.append(sid)

    sio = FakeSio()
    await replace_patron_agent_socket_exclusive(sio, "only", "hk")
    forget_patron_agent_socket("only")
    await replace_patron_agent_socket_exclusive(sio, "fresh", "hk")
    assert sio.disconnected == []
