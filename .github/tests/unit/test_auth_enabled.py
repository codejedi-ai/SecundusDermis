"""AUTH_ENABLED flag — sign-in disconnected without deleting routes."""

from __future__ import annotations

import importlib

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def auth_disabled_app(monkeypatch):
    monkeypatch.setenv("AUTH_ENABLED", "false")
    import config as cfg

    importlib.reload(cfg)
    import api

    importlib.reload(api)
    return api.app


@pytest.mark.asyncio
async def test_auth_config_reports_disabled(auth_disabled_app):
    transport = ASGITransport(app=auth_disabled_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/api/auth/config")
    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is False
    assert body["ephemeral_mode"] is True


@pytest.mark.asyncio
async def test_login_returns_503_when_disabled(auth_disabled_app):
    transport = ASGITransport(app=auth_disabled_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post("/api/auth/login", json={"email": "a@b.c", "password": "x"})
    assert r.status_code == 503


@pytest.mark.asyncio
async def test_house_agent_key_without_session_when_disabled(auth_disabled_app, monkeypatch, tmp_path):
    monkeypatch.setattr("config.DATA_DIR", tmp_path)
    import agent_api_keys
    import house_agent_key

    importlib.reload(agent_api_keys)
    importlib.reload(house_agent_key)

    transport = ASGITransport(app=auth_disabled_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/api/auth/house-agent-key")
    assert r.status_code == 200
    body = r.json()
    assert body["token"].startswith("sdag_")
