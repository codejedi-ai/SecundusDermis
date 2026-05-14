"""Socket.IO room and helpers for trusted stylist agent <-> backend duplex channel."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

# All connections authenticated as role ``agent`` join this room for backend→agent pushes.
AGENT_SERVICE_ROOM = "sd_agent_service"

# Browsers on ``/agents`` join this room for ``deployment_stats`` (same payload as ``GET /api/catalog/stats``)
# when trusted agent Socket.IO connections connect or disconnect.
DEPLOYMENT_STATS_ROOM = "sd_deployment_stats_watchers"

logger = logging.getLogger(__name__)

# One active Socket.IO ``agent`` session per patron API key hash (``sdag_…``). New connection evicts the old.
_patron_agent_sid_by_key_hash: dict[str, str] = {}
_patron_agent_socket_lock = asyncio.Lock()


async def replace_patron_agent_socket_exclusive(sio: Any, sid: str, key_hash: str) -> None:
    """Register ``sid`` as the owner of ``key_hash``; disconnect any previous socket for that key."""
    async with _patron_agent_socket_lock:
        old_sid = _patron_agent_sid_by_key_hash.get(key_hash)
        if old_sid and old_sid != sid:
            try:
                await sio.disconnect(
                    old_sid,
                    reason="superseded by another agent connection using the same patron API key",
                )
            except Exception as e:
                logger.debug("[SOCKETIO] disconnect prior patron-agent sid=%s: %s", old_sid, e)
        _patron_agent_sid_by_key_hash[key_hash] = sid


def forget_patron_agent_socket(sid: str) -> None:
    """Drop registry entries pointing at ``sid`` (compare-then-pop so replacement is not cleared)."""
    for h in list(_patron_agent_sid_by_key_hash.keys()):
        if _patron_agent_sid_by_key_hash.get(h) == sid:
            _patron_agent_sid_by_key_hash.pop(h, None)


async def emit_to_agent_connections(sio: Any, event: str, data: dict[str, Any] | None) -> None:
    """Emit an event to every trusted agent Socket.IO connection."""
    await sio.emit(event, dict(data or {}), room=AGENT_SERVICE_ROOM)


def count_room_participants(sio: Any, room: str, namespace: str = "/") -> int:
    """Count active Socket.IO sessions in ``room`` (default namespace ``/``)."""
    try:
        return len(list(sio.manager.get_participants(namespace, room)))
    except (KeyError, TypeError, AttributeError):
        return 0
