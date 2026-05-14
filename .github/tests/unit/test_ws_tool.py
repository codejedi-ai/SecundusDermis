"""Unit tests for ``stylist_loop.ws_tool`` (host allowlist, origin, secret check)."""

from __future__ import annotations

import pytest

from stylist_loop.ws_tool import (
    pick_effective_secret,
    resolve_socket_origin,
    websocket_host_allowed,
)


def test_websocket_host_allowed_loopback():
    assert websocket_host_allowed("127.0.0.1", "http://example.com:8000")
    assert websocket_host_allowed("http://localhost:9999/x", "http://example.com:8000")


def test_websocket_host_allowed_matches_backend_url():
    assert websocket_host_allowed("api.sd.test", "https://api.sd.test:443/v1")


def test_websocket_host_allowed_extra_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SD_WEBSOCKET_ALLOWED_HOSTS", "edge.internal,10.1.2.3")
    assert websocket_host_allowed("edge.internal", "http://127.0.0.1:8000")
    assert websocket_host_allowed("10.1.2.3", "http://127.0.0.1:8000")
    assert not websocket_host_allowed("evil.example", "http://127.0.0.1:8000")


def test_resolve_socket_origin_uses_backend_port():
    assert resolve_socket_origin("127.0.0.1", None, "http://127.0.0.1:8000") == "http://127.0.0.1:8000"
    assert resolve_socket_origin("10.0.0.5", 9000, "http://127.0.0.1:8000") == "http://10.0.0.5:9000"
    assert resolve_socket_origin("http://192.168.1.1:8080", None, "http://127.0.0.1:8000") == "http://192.168.1.1:8080"


def test_pick_effective_secret():
    assert pick_effective_secret(None, "secret") == (True, "secret")
    assert pick_effective_secret("", "secret") == (True, "secret")
    assert pick_effective_secret("secret", "secret") == (True, "secret")
    assert pick_effective_secret("wrong", "secret") == (False, "")
    assert pick_effective_secret(None, "") == (False, "")
