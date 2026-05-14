"""
Secundus «websocket» tool — validate host, then talk to the API Socket.IO server as role ``agent``.

Used by :func:`stylist_loop.stream_loop.gemini_chat_stream` via :meth:`StylistAgentDeps.websocket_channel`.
"""

from __future__ import annotations

import logging
import os
import secrets
from typing import Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


def _bare_host_port(host: str) -> tuple[str, Optional[int]]:
    """``host`` may be ``api.example.com``, ``10.0.0.1:8000``, or ``http://host:port``."""
    h = host.strip()
    if not h:
        return "", None
    if "://" in h:
        u = urlparse(h)
        hn = (u.hostname or "").lower()
        return hn, u.port
    first = h.split("/")[0]
    if ":" in first:
        name, _, p = first.rpartition(":")
        try:
            return name.strip().lower(), int(p)
        except ValueError:
            return first.lower(), None
    return first.lower(), None


def websocket_host_allowed(host: str, backend_url: str) -> bool:
    """Allow loopback, host that matches ``BACKEND_URL``, and ``SD_WEBSOCKET_ALLOWED_HOSTS``."""
    hn, _ = _bare_host_port(host)
    if not hn:
        return False
    if hn in ("127.0.0.1", "localhost", "::1"):
        return True
    bu = urlparse(backend_url)
    bhn = (bu.hostname or "").lower()
    if bhn and hn == bhn:
        return True
    extra = os.getenv("SD_WEBSOCKET_ALLOWED_HOSTS", "").strip()
    if not extra:
        return False
    allowed = {_bare_host_port(x.strip())[0] for x in extra.split(",") if x.strip()}
    return hn in allowed


def resolve_socket_origin(host: str, port: Optional[int], backend_url: str) -> str:
    """Build ``scheme://host:port`` for Socket.IO client ``connect``."""
    h = host.strip().rstrip("/")
    if h.startswith("http://") or h.startswith("https://"):
        return h.rstrip("/")
    bu = urlparse(backend_url)
    scheme = bu.scheme or "http"
    _, hinted = _bare_host_port(host)
    def_port = bu.port
    if def_port is None:
        def_port = 443 if scheme == "https" else 8000
    use_port = hinted if hinted is not None else (port if port is not None else def_port)
    hn, inline_port = _bare_host_port(host)
    if inline_port is not None:
        return f"{scheme}://{hn}:{inline_port}"
    return f"{scheme}://{hn}:{use_port}"


def pick_effective_secret(agent_secret: Optional[str], configured: str) -> tuple[bool, str]:
    """If ``agent_secret`` is set it must match ``configured`` (timing-safe)."""
    if not configured:
        return False, ""
    if agent_secret is None or not str(agent_secret).strip():
        return True, configured
    if secrets.compare_digest(str(agent_secret).strip(), configured):
        return True, configured
    return False, ""


def websocket_channel_sync(origin: str, secret: str, content: dict[str, Any]) -> dict[str, Any]:
    """
    One short-lived Socket.IO session: connect as ``agent``, emit one envelope, disconnect.

    ``content`` keys:
    - ``mode`` — ``patron_emit`` | ``agent_bridge`` | ``agent_ping``
    - ``patron_emit``: ``session_id``, ``event``, ``data`` (object)
    - ``agent_bridge`` / ``agent_ping``: ``payload`` (object, optional)
    """
    import socketio

    raw = dict(content or {})
    mode = str(raw.get("mode") or raw.get("target") or "").strip().lower()
    aliases = {
        "patron_room": "patron_emit",
        "emit_patron": "patron_emit",
        "to_patron": "patron_emit",
    }
    mode = aliases.get(mode, mode)

    client = socketio.Client(
        reconnection=False,
        logger=False,
        engineio_logger=False,
    )
    try:
        client.connect(
            origin,
            socketio_path="/socket.io",
            auth={"agent_secret": secret},
            transports=["websocket", "polling"],
            wait_timeout=15,
        )
        if mode in ("patron_emit",):
            session_id = str(raw.get("session_id") or "").strip()
            event = str(raw.get("event") or "").strip()
            data = raw.get("data") if isinstance(raw.get("data"), dict) else {}
            if not session_id or not event:
                return {"status": "error", "error": "patron_emit requires session_id and event"}
            client.emit("agent_emit", {"session_id": session_id, "event": event, "data": data})
        elif mode == "agent_bridge":
            pl = raw.get("payload") if isinstance(raw.get("payload"), dict) else {}
            if not pl and isinstance(raw.get("data"), dict):
                pl = raw["data"]
            client.emit("agent_bridge", pl)
        elif mode == "agent_ping":
            pl = raw.get("payload") if isinstance(raw.get("payload"), dict) else {}
            client.emit("agent_ping", pl)
        else:
            return {
                "status": "error",
                "error": f"unknown mode {mode!r}; use patron_emit, agent_bridge, or agent_ping",
            }
        return {"status": "ok", "mode": mode, "origin": origin}
    except Exception as exc:
        logger.warning("[websocket tool] Socket.IO failed: %s", exc)
        return {"status": "error", "error": str(exc)}
    finally:
        try:
            client.disconnect()
        except Exception:
            pass
