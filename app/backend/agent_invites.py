"""
One-time agent registration codes (``sdreg_…``).

A patron mints an invite while signed in. An external agent calls
``POST /api/patron/agent/register`` with that code **once**; the API consumes the
invite and returns a normal ``sdag_…`` credential (shown only in that response).
"""

from __future__ import annotations

import hashlib
import json
import secrets
import time
import uuid
from pathlib import Path
from typing import Any, Optional

import agent_api_keys
import config

PREFIX = "sdreg_"
_INVITES_FILE = "auth_agent_invites.json"


def _invites_path() -> Path:
    return Path(config.DATA_DIR) / _INVITES_FILE


def _load() -> dict[str, Any]:
    p = _invites_path()
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else {"invites": {}}
    except Exception:
        return {"invites": {}}


def _save(data: dict[str, Any]) -> None:
    Path(config.DATA_DIR).mkdir(parents=True, exist_ok=True)
    _invites_path().write_text(json.dumps(data, indent=2), encoding="utf-8")


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_invite(email: str, label: str) -> tuple[str, dict[str, Any]]:
    """Return ``(plaintext_sdreg_once, public_metadata_without_secret)``."""
    raw = PREFIX + secrets.token_urlsafe(32)
    token_hash = _hash_token(raw)
    iid = str(uuid.uuid4())
    em = email.strip().lower()
    now = time.time()
    prefix = raw[:16] + "…"
    rec: dict[str, Any] = {
        "id": iid,
        "email": em,
        "token_hash": token_hash,
        "label": (label or "").strip() or "Agent",
        "created_at": now,
        "used_at": None,
        "consumed_key_id": None,
    }
    data = _load()
    invites: dict[str, Any] = data.setdefault("invites", {})
    invites[iid] = rec
    _save(data)
    public = {k: v for k, v in rec.items() if k != "token_hash"}
    return raw, public


def list_pending_invites_public(email: str) -> list[dict[str, Any]]:
    """Pending invites for this patron (no secrets)."""
    em = email.strip().lower()
    out: list[dict[str, Any]] = []
    for rec in _load().get("invites", {}).values():
        if (rec.get("email") or "").strip().lower() != em:
            continue
        if rec.get("used_at") is not None:
            continue
        out.append(
            {
                "id": rec["id"],
                "label": rec.get("label") or "Agent",
                "prefix": rec.get("prefix") or PREFIX + "…",
                "created_at": float(rec.get("created_at") or 0),
            }
        )
    out.sort(key=lambda r: float(r.get("created_at") or 0), reverse=True)
    return out


def try_consume_invite(raw_code: str, agent_name: str) -> Optional[tuple[str, dict[str, Any]]]:
    """
    If ``raw_code`` matches an unused invite, create a patron agent key and return
    ``(sdag_plaintext_once, public_key_meta)``. Otherwise ``None`` (invalid or already used).
    """
    token = (raw_code or "").strip()
    if not token.startswith(PREFIX) or len(token) < len(PREFIX) + 8:
        return None
    want = _hash_token(token)
    data = _load()
    invites: dict[str, Any] = data.get("invites") or {}
    for iid, rec in list(invites.items()):
        if rec.get("token_hash") != want:
            continue
        if rec.get("used_at") is not None:
            return None
        em = (rec.get("email") or "").strip().lower()
        if not em:
            return None
        name = (agent_name or "").strip() or (rec.get("label") or "Agent")
        raw_sdag, meta = agent_api_keys.create_key(em, name[:120])
        rec["used_at"] = time.time()
        rec["consumed_key_id"] = meta.get("id")
        invites[iid] = rec
        _save(data)
        return (raw_sdag, meta)
    return None
