"""
Persistent **Boutique vs Atelier** preference per patron email.

Stored in ``user_experience.json`` under ``DATA_DIR`` (same tree as catalog and auth sessions) so it survives
API restarts and is not tied to a single browser tab.

**Boutique** — catalog-first showroom. **Atelier** — AI stylist, agents hub, chat.
Keyed by normalized email for both file-backed and Notion-backed accounts.
"""

from __future__ import annotations

import json
from typing import Literal

import config

_PATH = config.DATA_DIR / "user_experience.json"
ValidMode = Literal["boutique", "atelier"]


def _load() -> dict:
    try:
        return json.loads(_PATH.read_text(encoding="utf-8")) if _PATH.exists() else {}
    except Exception:
        return {}


def _save(data: dict) -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    _PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_experience_mode(email: str) -> ValidMode:
    e = email.lower().strip()
    raw = (_load().get(e) or "boutique")
    if isinstance(raw, str):
        v = raw.strip().lower()
        if v in ("boutique", "atelier"):
            return v  # type: ignore[return-value]
    return "boutique"


def set_experience_mode(email: str, mode: str) -> ValidMode:
    e = email.lower().strip()
    m = (mode or "boutique").strip().lower()
    if m not in ("boutique", "atelier"):
        m = "boutique"
    data = _load()
    data[e] = m
    _save(data)
    return m  # type: ignore[return-value]
