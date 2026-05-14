"""Tests for ``agent_prompts`` — soul markdown merged into stylist system prompt."""

from __future__ import annotations

from pathlib import Path

import pytest

import agent_prompts


def test_merge_prompts_with_soul_appends_section(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    soul = tmp_path / "soul.md"
    soul.write_text("**Voice:** quiet luxury.\n", encoding="utf-8")
    monkeypatch.setattr(agent_prompts, "_SOUL_PATH", soul)

    base = "You are the stylist."
    out = agent_prompts.merge_prompts_with_soul({"system_stylist": base})

    assert "## Atelier soul" in out["system_stylist"]
    assert base in out["system_stylist"]
    assert "quiet luxury" in out["system_stylist"]
    assert out["system_stylist"].index(base) < out["system_stylist"].index("## Atelier soul")


def test_merge_prompts_with_soul_only_soul_when_base_missing(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    soul = tmp_path / "soul.md"
    soul.write_text("Solo soul.", encoding="utf-8")
    monkeypatch.setattr(agent_prompts, "_SOUL_PATH", soul)

    out = agent_prompts.merge_prompts_with_soul({})
    assert out["system_stylist"] == "Solo soul."


def test_merge_prompts_with_soul_no_file_leaves_prompts_unchanged(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    missing = tmp_path / "nope.md"
    monkeypatch.setattr(agent_prompts, "_SOUL_PATH", missing)

    original = {"system_stylist": "X", "other": 1}
    out = agent_prompts.merge_prompts_with_soul(original)

    assert out["system_stylist"] == "X"
    assert out["other"] == 1


def test_merge_returns_shallow_copy_input_unchanged():
    inp = {"system_stylist": "A", "x": 1}
    out = agent_prompts.merge_prompts_with_soul(inp)
    assert out is not inp
    out["system_stylist"] = "B"
    assert inp["system_stylist"] == "A"
