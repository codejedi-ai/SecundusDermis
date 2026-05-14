"""Agent-side Gemini env resolution (no real key required)."""

from __future__ import annotations

import os

import pytest


def test_resolve_gemini_api_key_prefers_gemini_env(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-first")
    monkeypatch.setenv("GOOGLE_API_KEY", "google-second")
    from agent_gemini import resolve_gemini_api_key

    assert resolve_gemini_api_key() == "gemini-first"


def test_resolve_gemini_api_key_falls_back_to_google(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("GOOGLE_API_KEY", "google-only")
    from agent_gemini import resolve_gemini_api_key

    assert resolve_gemini_api_key() == "google-only"


def test_require_gemini_api_key_raises_when_missing(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    from agent_gemini import require_gemini_api_key

    with pytest.raises(RuntimeError, match="Gemini API key missing"):
        require_gemini_api_key()


def test_apply_agent_env_non_empty_skips_blank_secret(tmp_path, monkeypatch):
    from agent_gemini import _apply_agent_env_non_empty

    p = tmp_path / ".env"
    p.write_text("AGENT_INTERNAL_SECRET=\nSD_EXTRA=value\n")
    monkeypatch.setenv("AGENT_INTERNAL_SECRET", "from-backend")
    monkeypatch.delenv("SD_EXTRA", raising=False)
    _apply_agent_env_non_empty(p)
    assert os.environ["AGENT_INTERNAL_SECRET"] == "from-backend"
    assert os.environ["SD_EXTRA"] == "value"
