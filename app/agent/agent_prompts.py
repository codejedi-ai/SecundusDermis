"""
Merge ``config/soul.md`` into the stylist system prompt so persona stays in the agent tree.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

_AGENT_ROOT = Path(__file__).resolve().parent
_SOUL_PATH = _AGENT_ROOT / "config" / "soul.md"


def load_soul_markdown() -> str:
    try:
        if _SOUL_PATH.is_file():
            return _SOUL_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        pass
    return ""


def merge_prompts_with_soul(prompts: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of ``prompts`` with ``system_stylist`` extended by ``soul.md`` when present."""
    out = dict(prompts)
    soul = load_soul_markdown()
    if not soul:
        return out
    base = (out.get("system_stylist") or "").strip()
    if base:
        out["system_stylist"] = f"{base}\n\n## Atelier soul\n\n{soul}".strip()
    else:
        out["system_stylist"] = soul
    return out
