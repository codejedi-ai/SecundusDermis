"""Patron-scoped agent API keys (``sdag_``) and context store."""

from __future__ import annotations

import importlib

import pytest


def test_agent_api_key_create_verify_list_revoke_context(monkeypatch, tmp_path):
    import config as cfg

    monkeypatch.setattr(cfg, "DATA_DIR", tmp_path)
    import agent_api_keys

    importlib.reload(agent_api_keys)

    raw, meta = agent_api_keys.create_key("Patron@Example.com", "Home agent")
    assert raw.startswith(agent_api_keys.PREFIX)
    assert "id" in meta and "token" not in meta
    assert agent_api_keys.verify_token(raw) == "patron@example.com"
    fp = agent_api_keys.verify_token_with_fingerprint(raw)
    assert fp is not None
    assert fp[0] == "patron@example.com"
    assert len(fp[1]) == 64
    assert agent_api_keys.verify_token_with_fingerprint("sdag_invalidtoken") is None

    listed = agent_api_keys.list_keys("patron@example.com")
    assert len(listed) == 1
    assert listed[0]["id"] == meta["id"]

    agent_api_keys.append_context_entries(
        "patron@example.com",
        [{"text": "Note one", "source": "test"}],
    )
    ctx = agent_api_keys.get_context("patron@example.com", limit=10)
    assert len(ctx) == 1
    assert ctx[0]["text"] == "Note one"

    assert agent_api_keys.revoke_key("patron@example.com", meta["id"]) is True
    assert agent_api_keys.verify_token(raw) is None
    assert agent_api_keys.verify_token_with_fingerprint(raw) is None
    assert agent_api_keys.revoke_key("patron@example.com", meta["id"]) is False


def test_append_agent_socket_online_flags(monkeypatch, tmp_path):
    import agent_socket_bridge
    import config as cfg

    monkeypatch.setattr(cfg, "DATA_DIR", tmp_path)
    import agent_api_keys

    importlib.reload(agent_socket_bridge)
    importlib.reload(agent_api_keys)

    raw, meta = agent_api_keys.create_key("a@test.com", "Agent A")
    listed = agent_api_keys.list_keys("a@test.com")
    assert len(listed) == 1
    out = agent_api_keys.append_agent_socket_online_flags(listed)
    assert out[0]["agent_socket_online"] is False

    fp = agent_api_keys.verify_token_with_fingerprint(raw)
    assert fp is not None
    key_hash = fp[1]
    agent_socket_bridge._patron_agent_sid_by_key_hash[key_hash] = "sid-test"
    out2 = agent_api_keys.append_agent_socket_online_flags(listed)
    assert out2[0]["agent_socket_online"] is True
    agent_socket_bridge._patron_agent_sid_by_key_hash.clear()


def test_patron_has_any_key(monkeypatch, tmp_path):
    import config as cfg

    monkeypatch.setattr(cfg, "DATA_DIR", tmp_path)
    import agent_api_keys

    importlib.reload(agent_api_keys)

    assert agent_api_keys.patron_has_any_key("patron@example.com") is False
    raw, meta = agent_api_keys.create_key("Patron@Example.com", "tool")
    assert agent_api_keys.patron_has_any_key("patron@example.com") is True
    assert agent_api_keys.revoke_key("patron@example.com", meta["id"]) is True
    assert agent_api_keys.patron_has_any_key("patron@example.com") is False
    assert agent_api_keys.verify_token(raw) is None
