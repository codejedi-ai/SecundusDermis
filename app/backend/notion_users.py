"""
Notion-backed user rows for SecundusDermis.

Rules (by product requirement):
  • Never create new pages in the users database — only PATCH existing rows.
  • A "free slot" is a row whose Email (title) property is empty.
  • When no free slot exists, registration raises NotionUsersFullError.

Env:
  NOTION_TOKEN                 — integration secret (required for this backend)
  NOTION_USERS_DATABASE_ID     — database UUID from the Notion URL
  AUTH_USERS_BACKEND=notion    — enable in auth.py

Schema (property names must match the Notion database):
  Email (title), Name (rich_text), password_hash (rich_text), email_verified (checkbox)
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

NOTION_VERSION = "2025-09-03"
BASE = "https://api.notion.com"

PROP_EMAIL = "Email"
PROP_NAME = "Name"
PROP_PASSWORD_HASH = "password_hash"
PROP_EMAIL_VERIFIED = "email_verified"


class NotionUsersFullError(Exception):
    """No row left with an empty Email title."""


class NotionUsersConfigError(Exception):
    """Missing NOTION_TOKEN or NOTION_USERS_DATABASE_ID."""


def _format_uuid(raw: str) -> str:
    r = raw.replace("-", "").strip()
    if len(r) == 32:
        return f"{r[0:8]}-{r[8:12]}-{r[12:16]}-{r[16:20]}-{r[20:32]}"
    return raw.strip()


def is_enabled() -> bool:
    return os.getenv("AUTH_USERS_BACKEND", "file").lower() in ("notion", "notion_users")


def is_configured() -> bool:
    return bool(os.getenv("NOTION_TOKEN") and os.getenv("NOTION_USERS_DATABASE_ID"))


def _require_config() -> Tuple[str, str]:
    token = os.getenv("NOTION_TOKEN", "").strip()
    db_id = os.getenv("NOTION_USERS_DATABASE_ID", "").strip()
    if not token or not db_id:
        raise NotionUsersConfigError(
            "Set NOTION_TOKEN and NOTION_USERS_DATABASE_ID for AUTH_USERS_BACKEND=notion."
        )
    return token, _format_uuid(db_id)


_cache: Optional[Tuple[float, List[dict]]] = None
_CACHE_TTL_SEC = 20.0


def _invalidate_cache() -> None:
    global _cache
    _cache = None


def _notion_request(
    method: str,
    path: str,
    token: str,
    body: Optional[dict] = None,
    *,
    retries: int = 4,
) -> Any:
    url = BASE + path
    data = None if body is None else json.dumps(body).encode("utf-8")
    delay = 1.0
    last_err: Optional[Exception] = None
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Notion-Version", NOTION_VERSION)
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw.strip() else {}
        except urllib.error.HTTPError as e:
            payload = e.read().decode("utf-8", errors="replace")
            last_err = RuntimeError(f"HTTP {e.code} {path}: {payload}")
            if e.code == 429 and attempt < retries:
                time.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            raise last_err from e
    raise last_err  # pragma: no cover


def _get_data_source_id(token: str, database_id: str) -> str:
    db = _notion_request("GET", f"/v1/databases/{database_id}", token)
    sources = db.get("data_sources") or []
    if not sources or not sources[0].get("id"):
        raise RuntimeError("Notion database has no data_sources; share DB with integration.")
    return sources[0]["id"]


def _query_all_pages(token: str, data_source_id: str) -> List[dict]:
    out: List[dict] = []
    cursor: Optional[str] = None
    while True:
        body: Dict[str, Any] = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        data = _notion_request(
            "POST", f"/v1/data_sources/{data_source_id}/query", token, body
        )
        for item in data.get("results") or []:
            if item.get("object") == "page":
                out.append(item)
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    return out


def _cached_pages(token: str, database_id: str) -> List[dict]:
    global _cache
    now = time.time()
    if _cache and now - _cache[0] < _CACHE_TTL_SEC:
        return _cache[1]
    ds = _get_data_source_id(token, database_id)
    pages = _query_all_pages(token, ds)
    _cache = (now, pages)
    return pages


def _plain_title(props: dict, name: str) -> str:
    p = props.get(name) or {}
    if p.get("type") != "title":
        return ""
    bits: List[str] = []
    for t in p.get("title") or []:
        bits.append(t.get("plain_text") or "")
    return "".join(bits).strip()


def _plain_rich_text(props: dict, name: str) -> str:
    p = props.get(name) or {}
    if p.get("type") != "rich_text":
        return ""
    bits: List[str] = []
    for t in p.get("rich_text") or []:
        bits.append(t.get("plain_text") or "")
    return "".join(bits).strip()


def _checkbox(props: dict, name: str) -> bool:
    p = props.get(name) or {}
    if p.get("type") != "checkbox":
        return True
    return bool(p.get("checkbox"))


def _page_record(page: dict) -> dict:
    props = page.get("properties") or {}
    email = _plain_title(props, PROP_EMAIL)
    return {
        "page_id": page.get("id"),
        "email": email,
        "email_lower": email.lower(),
        "name": _plain_rich_text(props, PROP_NAME),
        "password_hash": _plain_rich_text(props, PROP_PASSWORD_HASH),
        "email_verified": _checkbox(props, PROP_EMAIL_VERIFIED),
    }


def _build_index(pages: List[dict]) -> Tuple[Dict[str, dict], List[dict]]:
    """email_lower -> record with page_id; empty_slots = pages with no email."""
    by_email: Dict[str, dict] = {}
    empty: List[dict] = []
    for pg in pages:
        rec = _page_record(pg)
        if not rec["email_lower"]:
            empty.append(rec)
        else:
            by_email[rec["email_lower"]] = rec
    return by_email, empty


def get_user_record(email: str) -> Optional[dict]:
    """Return {page_id, email, name, password_hash, email_verified} or None."""
    token, db_id = _require_config()
    email_l = email.lower().strip()
    pages = _cached_pages(token, db_id)
    by_e, _ = _build_index(pages)
    return by_e.get(email_l)


def patch_user_page(
    page_id: str,
    *,
    email: Optional[str] = None,
    name: Optional[str] = None,
    password_hash: Optional[str] = None,
    email_verified: Optional[bool] = None,
) -> None:
    token, _ = _require_config()
    props: Dict[str, Any] = {}
    if email is not None:
        props[PROP_EMAIL] = {
            "title": [{"type": "text", "text": {"content": email}}],
        }
    if name is not None:
        props[PROP_NAME] = {
            "rich_text": [{"type": "text", "text": {"content": name}}],
        }
    if password_hash is not None:
        props[PROP_PASSWORD_HASH] = {
            "rich_text": [{"type": "text", "text": {"content": password_hash}}],
        }
    if email_verified is not None:
        props[PROP_EMAIL_VERIFIED] = {"checkbox": email_verified}
    if not props:
        return
    _notion_request(
        "PATCH",
        f"/v1/pages/{page_id}",
        token,
        {"properties": props},
    )
    _invalidate_cache()


def claim_empty_row_and_fill(
    email: str,
    password_hash: str,
    name: str,
    *,
    email_verified: bool = False,
) -> str:
    """
    Find a row with empty Email, PATCH all fields. Returns page_id.
    Raises NotionUsersFullError if no slot. Raises RuntimeError if email taken.
    """
    token, db_id = _require_config()
    email_l = email.lower().strip()
    _invalidate_cache()
    pages = _cached_pages(token, db_id)
    by_e, empty = _build_index(pages)
    if email_l in by_e:
        raise RuntimeError("email_already_registered")
    if not empty:
        raise NotionUsersFullError(
            "No free row in Notion users database (Email title must be empty on a row)."
        )
    page_id = empty[0]["page_id"]
    patch_user_page(
        page_id,
        email=email,
        name=name,
        password_hash=password_hash,
        email_verified=email_verified,
    )
    return page_id


def update_user_verified(email: str, verified: bool = True) -> bool:
    rec = get_user_record(email)
    if not rec:
        return False
    patch_user_page(rec["page_id"], email_verified=verified)
    return True


def update_password_hash_for_email(email: str, password_hash: str) -> bool:
    rec = get_user_record(email)
    if not rec:
        return False
    patch_user_page(rec["page_id"], password_hash=password_hash)
    return True


def update_user_name(email: str, name: str) -> bool:
    rec = get_user_record(email)
    if not rec:
        return False
    patch_user_page(rec["page_id"], name=name)
    return True


def user_exists(email: str) -> bool:
    return get_user_record(email) is not None
