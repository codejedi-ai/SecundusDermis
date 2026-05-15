"""
Per-patron API keys for autonomous agents and tools (separate from ``AGENT_INTERNAL_SECRET``).

- Users create keys while signed in; the plaintext is shown once (``sdag_…``).
- Only SHA-256 hashes are stored on disk under ``DATA_DIR``.
- Any HTTP client may call ``/patron/agent/*`` with ``Authorization: Bearer <token>`` or
  ``X-Patron-Agent-Api-Key`` for patron-scoped chat, context, and ``me`` (not legacy ``/api/chat*``).
"""

from __future__ import annotations

import hashlib
import json
import secrets
import time
import uuid
from pathlib import Path
from typing import Any, Optional

import config

PREFIX = "sdag_"
_KEYS_FILE_NAME = "auth_agent_api_keys.json"
_CONTEXT_FILE_NAME = "patron_agent_context.json"
MAX_CONTEXT_PER_USER = 80


def _keys_path() -> Path:
    return Path(config.DATA_DIR) / _KEYS_FILE_NAME


def _context_path() -> Path:
    return Path(config.DATA_DIR) / _CONTEXT_FILE_NAME


def _load_keys() -> dict[str, Any]:
    p = _keys_path()
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else {"keys": {}}
    except Exception:
        return {"keys": {}}


def _save_keys(data: dict[str, Any]) -> None:
    Path(config.DATA_DIR).mkdir(parents=True, exist_ok=True)
    _keys_path().write_text(json.dumps(data, indent=2), encoding="utf-8")


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_key(email: str, label: str) -> tuple[str, dict[str, Any]]:
    """Return ``(plaintext_token_once, public_metadata)``."""
    raw = PREFIX + secrets.token_urlsafe(32)
    token_hash = _hash_token(raw)
    kid = str(uuid.uuid4())
    em = email.strip().lower()
    now = time.time()
    prefix = raw[:14] + "…"
    rec: dict[str, Any] = {
        "id": kid,
        "email": em,
        "token_hash": token_hash,
        "prefix": prefix,
        "label": (label or "").strip() or "Agent",
        "created_at": now,
        "last_used_at": None,
    }
    data = _load_keys()
    keys: dict[str, Any] = data.setdefault("keys", {})
    keys[kid] = rec
    _save_keys(data)
    public = {k: v for k, v in rec.items() if k != "token_hash"}
    return raw, public


def list_keys(email: str) -> list[dict[str, Any]]:
    em = email.strip().lower()
    out: list[dict[str, Any]] = []
    for rec in _load_keys().get("keys", {}).values():
        if (rec.get("email") or "").strip().lower() != em:
            continue
        out.append({k: v for k, v in rec.items() if k != "token_hash"})
    out.sort(key=lambda r: float(r.get("created_at") or 0), reverse=True)
    return out


def append_agent_socket_online_flags(keys: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Attach ``agent_socket_online`` to each key row (Socket.IO agent authenticated with that key)."""
    from agent_socket_bridge import connected_patron_agent_key_hashes_snapshot

    online = connected_patron_agent_key_hashes_snapshot()
    by_id: dict[str, Any] = _load_keys().get("keys") or {}
    merged: list[dict[str, Any]] = []
    for k in keys:
        rid = k.get("id")
        rec = by_id.get(rid) if isinstance(rid, str) else None
        th = (rec or {}).get("token_hash") if isinstance(rec, dict) else None
        merged.append({**k, "agent_socket_online": bool(th and th in online)})
    return merged


def patron_has_any_key(email: str) -> bool:
    """True if this patron has at least one active (non-revoked) agent API key."""
    return len(list_keys(email)) > 0


def revoke_key(email: str, key_id: str) -> bool:
    em = email.strip().lower()
    data = _load_keys()
    keys: dict[str, Any] = data.get("keys") or {}
    rec = keys.get(key_id)
    if not rec or (rec.get("email") or "").strip().lower() != em:
        return False
    del keys[key_id]
    _save_keys(data)
    return True


def verify_token_with_fingerprint(raw: str) -> Optional[tuple[str, str]]:
    """If ``raw`` matches a stored key, return ``(patron_email_lowercase, token_sha256_hex)``; else ``None``."""
    token = (raw or "").strip()
    if not token.startswith(PREFIX) or len(token) < len(PREFIX) + 8:
        return None
    want = _hash_token(token)
    data = _load_keys()
    changed = False
    em_out: Optional[str] = None
    for kid, rec in list((data.get("keys") or {}).items()):
        if rec.get("token_hash") != want:
            continue
        em = (rec.get("email") or "").strip().lower()
        if not em:
            return None
        em_out = em
        now = time.time()
        if rec.get("last_used_at") is None or now - float(rec.get("last_used_at") or 0) > 30.0:
            rec["last_used_at"] = now
            changed = True
        break
    if changed:
        _save_keys(data)
    if em_out is None:
        return None
    return (em_out, want)


def verify_token(raw: str) -> Optional[str]:
    """If ``raw`` matches a stored key, return patron email (lowercase); else ``None``."""
    t = verify_token_with_fingerprint(raw)
    return t[0] if t else None


def _load_context() -> dict[str, Any]:
    p = _context_path()
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else {"by_email": {}}
    except Exception:
        return {"by_email": {}}


def _save_context(data: dict[str, Any]) -> None:
    Path(config.DATA_DIR).mkdir(parents=True, exist_ok=True)
    _context_path().write_text(json.dumps(data, indent=2), encoding="utf-8")


def append_context_entries(email: str, entries: list[dict[str, Any]]) -> int:
    """Append structured notes for a patron; returns new total count for that user."""
    em = email.strip().lower()
    data = _load_context()
    bucket: dict[str, list] = data.setdefault("by_email", {})
    cur: list[dict[str, Any]] = list(bucket.get(em) or [])
    now = time.time()
    for e in entries:
        text = (e.get("text") or "").strip()
        if not text:
            continue
        if len(text) > 8000:
            text = text[:8000]
        cur.append(
            {
                "ts": now,
                "text": text,
                "source": (e.get("source") or "agent").strip()[:64] or "agent",
            }
        )
    if len(cur) > MAX_CONTEXT_PER_USER:
        cur = cur[-MAX_CONTEXT_PER_USER:]
    bucket[em] = cur
    _save_context(data)
    return len(cur)


def get_context(email: str, limit: int = 50) -> list[dict[str, Any]]:
    em = email.strip().lower()
    cur = list((_load_context().get("by_email") or {}).get(em) or [])
    if limit < 1:
        limit = 1
    return cur[-limit:]
