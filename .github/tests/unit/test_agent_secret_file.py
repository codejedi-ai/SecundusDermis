"""Ephemeral shared ``AGENT_INTERNAL_SECRET`` file under ``DATA_DIR``."""

from __future__ import annotations

import os

import pytest


def test_read_or_create_prefers_env(monkeypatch, tmp_path):
    monkeypatch.setenv("AGENT_INTERNAL_SECRET", "from-env")
    from agent_secret_file import read_or_create_agent_internal_secret

    assert read_or_create_agent_internal_secret(tmp_path) == "from-env"
    assert not (tmp_path / ".sd_agent_internal_secret").exists()


def test_read_or_create_writes_and_reuses_file(tmp_path, monkeypatch):
    monkeypatch.delenv("AGENT_INTERNAL_SECRET", raising=False)
    from agent_secret_file import read_or_create_agent_internal_secret

    a = read_or_create_agent_internal_secret(tmp_path)
    assert len(a) >= 32
    b = read_or_create_agent_internal_secret(tmp_path)
    assert a == b
    raw = (tmp_path / ".sd_agent_internal_secret").read_text(encoding="utf-8").strip()
    assert raw == a


def test_read_or_create_race_second_reader(tmp_path, monkeypatch):
    monkeypatch.delenv("AGENT_INTERNAL_SECRET", raising=False)
    from agent_secret_file import read_or_create_agent_internal_secret

    path = tmp_path / ".sd_agent_internal_secret"
    tmp_path.mkdir(parents=True, exist_ok=True)
    path.write_text("winner\n", encoding="utf-8")
    assert read_or_create_agent_internal_secret(tmp_path) == "winner"
