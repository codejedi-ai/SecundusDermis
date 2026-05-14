"""Lightweight invariants on ``config`` path layout (no env reload)."""

from __future__ import annotations

import config


def test_data_dir_is_app_data():
    assert config.DATA_DIR == config.APP_DATA_DIR
    assert config.APP_DATA_DIR.name == "data"


def test_derived_dirs_under_data_dir():
    assert config.JOURNAL_DIR == config.DATA_DIR / "journal"
    assert config.CHROMA_DIR == config.DATA_DIR / "chroma_db"
    assert config.PROMPTS_FILE == config.DATA_DIR / "prompts.json"
    assert config.UPLOADS_DIR == config.DATA_DIR / "uploads"
