"""CORS origin list for credentialed browser fetches (no wildcard with cookies / fetch credentials)."""

from __future__ import annotations

import importlib

import pytest


def test_cors_allow_origins_merges_frontend_and_extra(monkeypatch):
    import config

    monkeypatch.setattr(config, "FRONTEND_PUBLIC_URL", "http://localhost:5173")
    monkeypatch.setattr(config, "CORS_ALLOWED_ORIGINS", "https://app.example, https://other.example")
    assert config.cors_allow_origins() == [
        "http://localhost:5173",
        "https://app.example",
        "https://other.example",
    ]


def test_cors_allow_origins_dedupes(monkeypatch):
    import config

    monkeypatch.setattr(config, "FRONTEND_PUBLIC_URL", "https://x.example")
    monkeypatch.setattr(config, "CORS_ALLOWED_ORIGINS", "https://x.example, https://y.example")
    assert config.cors_allow_origins() == ["https://x.example", "https://y.example"]


def test_cors_allow_origin_regex_unset_uses_localhost_pattern():
    import config

    assert config.CORS_ALLOW_ORIGIN_REGEX == r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"


def test_cors_allow_origin_regex_empty_env_disables(monkeypatch):
    monkeypatch.setenv("CORS_ALLOW_ORIGIN_REGEX", "")
    import config as cfg

    importlib.reload(cfg)
    try:
        assert cfg.CORS_ALLOW_ORIGIN_REGEX is None
    finally:
        monkeypatch.delenv("CORS_ALLOW_ORIGIN_REGEX", raising=False)
        importlib.reload(cfg)


def test_cors_enabled_defaults_true(monkeypatch):
    monkeypatch.delenv("CORS_ENABLED", raising=False)
    import config as cfg

    importlib.reload(cfg)
    try:
        assert cfg.CORS_ENABLED is True
    finally:
        importlib.reload(cfg)


def test_cors_enabled_false(monkeypatch):
    monkeypatch.setenv("CORS_ENABLED", "false")
    import config as cfg

    importlib.reload(cfg)
    try:
        assert cfg.CORS_ENABLED is False
    finally:
        monkeypatch.delenv("CORS_ENABLED", raising=False)
        importlib.reload(cfg)
