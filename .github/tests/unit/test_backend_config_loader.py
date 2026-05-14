"""Regression: agent must load ``app/backend/config.py``, not a shadowing ``config`` module."""

from __future__ import annotations


def test_backend_config_points_at_backend_package_file():
    from secundus_agent import backend_config as bc

    path = bc.api_config.__file__.replace("\\", "/")
    assert path.endswith("app/backend/config.py") or "/backend/config.py" in path


def test_backend_config_exposes_agent_secret_and_model():
    from secundus_agent.backend_config import api_config

    assert hasattr(api_config, "AGENT_INTERNAL_SECRET")
    assert hasattr(api_config, "MODEL")
    assert isinstance(getattr(api_config, "AGENT_INTERNAL_SECRET"), str)


def test_agent_internal_secret_reads_os_env(monkeypatch, tmp_path):
    from secundus_agent import backend_config as bc

    monkeypatch.setattr(bc.api_config, "DATA_DIR", tmp_path)
    monkeypatch.setenv("AGENT_INTERNAL_SECRET", "test-secret-value")
    assert bc.agent_internal_secret() == "test-secret-value"
    monkeypatch.delenv("AGENT_INTERNAL_SECRET", raising=False)
    out = bc.agent_internal_secret()
    assert len(out) >= 32
    assert (tmp_path / ".sd_agent_internal_secret").read_text(encoding="utf-8").strip() == out
