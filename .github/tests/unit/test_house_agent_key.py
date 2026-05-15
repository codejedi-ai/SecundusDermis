"""House stylist auto-provisioned patron keys (boutique chat)."""

from __future__ import annotations

import importlib

import pytest


def test_get_or_create_house_agent_key_idempotent(monkeypatch, tmp_path):
    import config as cfg

    monkeypatch.setattr(cfg, "DATA_DIR", tmp_path)
    import agent_api_keys
    import house_agent_key

    importlib.reload(agent_api_keys)
    importlib.reload(house_agent_key)

    t1 = house_agent_key.get_or_create_house_agent_key("Patron@Example.com")
    t2 = house_agent_key.get_or_create_house_agent_key("patron@example.com")
    assert t1 == t2
    assert t1.startswith("sdag_")
    assert agent_api_keys.verify_token(t1) == "patron@example.com"

    listed = agent_api_keys.list_keys("patron@example.com")
    assert len(listed) == 1
    assert listed[0]["label"] == house_agent_key.HOUSE_AGENT_LABEL
