"""AGENT_MANIFEST.md exists at repo root and documents SD integration."""

from __future__ import annotations

from pathlib import Path


def test_agent_manifest_exists_and_mentions_socketio():
    repo = Path(__file__).resolve().parents[3]
    manifest = repo / "AGENT_MANIFEST.md"
    assert manifest.is_file(), "AGENT_MANIFEST.md should live at repository root"
    text = manifest.read_text(encoding="utf-8")
    assert "Socket.IO" in text
    assert "sd_" in text
    assert "/internal/agent/" in text
