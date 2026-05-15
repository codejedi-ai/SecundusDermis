"""
Per-patron **house stylist** API key — auto-provisioned for in-browser boutique chat.

The plaintext ``sdag_…`` is stored server-side (demo deployment) so signed-in patrons
do not need the Agents hub to mint a key. Atelier patrons may still use onboarded agents
via ``/agents``; boutique chat always uses this house key on ``/api/patron/agent/*``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import agent_api_keys
import config

HOUSE_AGENT_LABEL = "House stylist (site)"
_TOKENS_FILE_NAME = "auth_house_agent_tokens.json"


def _tokens_path() -> Path:
    return Path(config.DATA_DIR) / _TOKENS_FILE_NAME


def _load_tokens() -> dict[str, Any]:
    p = _tokens_path()
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else {}
    except Exception:
        return {}


def _save_tokens(data: dict[str, Any]) -> None:
    Path(config.DATA_DIR).mkdir(parents=True, exist_ok=True)
    _tokens_path().write_text(json.dumps(data, indent=2), encoding="utf-8")


def _key_id_still_active(email: str, key_id: str) -> bool:
    for rec in agent_api_keys.list_keys(email):
        if rec.get("id") == key_id:
            return True
    return False


def get_or_create_house_agent_key(email: str) -> str:
    """Return a patron ``sdag_…`` for the house stylist; create and persist if needed."""
    em = email.strip().lower()
    if not em:
        raise ValueError("email required")

    data = _load_tokens()
    entry = data.get(em)
    if isinstance(entry, dict):
        kid = entry.get("key_id")
        token = entry.get("token")
        if isinstance(kid, str) and isinstance(token, str) and token.startswith(agent_api_keys.PREFIX):
            if _key_id_still_active(em, kid) and agent_api_keys.verify_token(token) == em:
                return token

    raw, meta = agent_api_keys.create_key(em, HOUSE_AGENT_LABEL)
    data[em] = {"key_id": meta["id"], "token": raw}
    _save_tokens(data)
    return raw
