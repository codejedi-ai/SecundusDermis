"""
Socket.IO client for a trusted SD stylist process: connect as role ``agent``, emit ``agent_emit``,
and receive backend→agent events (e.g. ``sd_bridge``).

Used when ``SD_SOCKETIO_EMIT`` or ``SD_AGENT_SOCKET`` is enabled; otherwise :class:`RemoteStylistDeps`
uses HTTP ``POST /internal/agent/emit`` only for patron-room fan-out.
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

OnSdBridge = Optional[Callable[[dict[str, Any]], None]]


class SdSocketEmitter:
    """Thread-safe wrapper around ``socketio.Client`` for patron fan-out and duplex agent bridge."""

    def __init__(self, backend_origin: str, agent_secret: str, *, on_sd_bridge: OnSdBridge = None) -> None:
        self._url = backend_origin.rstrip("/")
        self._secret = agent_secret
        self._on_sd_bridge = on_sd_bridge
        self._lock = threading.Lock()
        self._sio: Any = None
        self._connected = False

    def _connect_locked(self) -> None:
        """Open Socket.IO connection. Caller must hold ``self._lock``."""
        if self._connected and self._sio is not None:
            return

        import socketio

        client = socketio.Client(
            reconnection=True,
            reconnection_delay=1,
            reconnection_delay_max=30,
            logger=False,
            engineio_logger=False,
        )

        @client.event
        def connect():
            logger.info("[SD-SocketIO] connected to %s as agent", self._url)

        @client.event
        def disconnect():
            logger.info("[SD-SocketIO] disconnected from %s", self._url)

        @client.event
        def connect_error(data):
            logger.warning("[SD-SocketIO] connect_error: %s", data)

        @client.on("sd_bridge")
        def on_sd_bridge(data):
            if not self._on_sd_bridge:
                if isinstance(data, dict) and data.get("type") != "welcome":
                    logger.info("[SD-SocketIO] sd_bridge (no handler): %s", data)
                return
            if isinstance(data, dict):
                try:
                    self._on_sd_bridge(data)
                except Exception as exc:
                    logger.warning("[SD-SocketIO] on_sd_bridge callback error: %s", exc)

        client.connect(
            self._url,
            socketio_path="/socket.io",
            auth={"agent_secret": self._secret},
            transports=["websocket", "polling"],
            wait_timeout=15,
        )
        self._sio = client
        self._connected = True

    def ensure_connected(self) -> None:
        with self._lock:
            self._connect_locked()

    def emit_to_patron_room(self, session_id: str, event: str, data: dict[str, Any]) -> None:
        """Emit ``agent_emit`` so the backend forwards ``event`` + ``data`` to room ``sd_{session_id}``.

        For stylist UI sync, ``event`` should be ``sd_stylist_message`` and ``data`` an ``sd.stylist.v1`` envelope.
        """
        payload = {
            "session_id": (session_id or "").strip(),
            "event": (event or "").strip(),
            "data": dict(data or {}),
        }
        with self._lock:
            self._connect_locked()
            assert self._sio is not None
            self._sio.emit("agent_emit", payload)

    def emit_agent_bridge(self, payload: dict[str, Any]) -> None:
        """Emit ``agent_bridge`` to the API (server may log or extend handlers)."""
        with self._lock:
            self._connect_locked()
            assert self._sio is not None
            self._sio.emit("agent_bridge", dict(payload or {}))

    def emit_agent_ping(self, payload: dict[str, Any] | None = None) -> None:
        """Request a ``sd_bridge`` pong from the server (duplex health check)."""
        with self._lock:
            self._connect_locked()
            assert self._sio is not None
            self._sio.emit("agent_ping", dict(payload or {}))

    def close(self) -> None:
        with self._lock:
            if self._sio is not None and self._connected:
                try:
                    self._sio.disconnect()
                except Exception as exc:
                    logger.debug("[SD-SocketIO] disconnect: %s", exc)
            self._sio = None
            self._connected = False
