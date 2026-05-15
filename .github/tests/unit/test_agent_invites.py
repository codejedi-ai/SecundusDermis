"""One-time agent registration invites (``sdreg_`` → ``sdag_``)."""

from __future__ import annotations

import importlib

import pytest


def test_invite_create_consume_one_time(monkeypatch, tmp_path):
    import config as cfg

    monkeypatch.setattr(cfg, "DATA_DIR", tmp_path)
    import agent_api_keys
    import agent_invites

    importlib.reload(agent_api_keys)
    importlib.reload(agent_invites)

    raw_reg, meta = agent_invites.create_invite("Patron@Example.com", "CI agent")
    assert raw_reg.startswith(agent_invites.PREFIX)
    assert meta.get("email") == "patron@example.com"
    assert meta.get("used_at") is None

    pending = agent_invites.list_pending_invites_public("patron@example.com")
    assert len(pending) == 1
    assert pending[0]["id"] == meta["id"]

    assert agent_invites.try_consume_invite("sdreg_not_a_real_code", "x") is None

    out = agent_invites.try_consume_invite(raw_reg, "runner-1")
    assert out is not None
    sdag, key_meta = out
    assert sdag.startswith(agent_api_keys.PREFIX)
    assert agent_api_keys.verify_token(sdag) == "patron@example.com"

    assert agent_invites.try_consume_invite(raw_reg, "runner-2") is None

    pending2 = agent_invites.list_pending_invites_public("patron@example.com")
    assert pending2 == []

    listed = agent_api_keys.list_keys("patron@example.com")
    assert len(listed) == 1
    assert listed[0]["id"] == key_meta["id"]
