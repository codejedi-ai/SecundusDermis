"""
Simple file-backed authentication for SecundusDermis.
Users and sessions persisted to JSON files — survive backend restarts.
"""

import hashlib
import json
import os
from pathlib import Path
from typing import Optional, Dict
from pydantic import BaseModel

_DATA_DIR = Path(os.getenv("AUTH_DATA_DIR", Path(__file__).parent / "data"))
_USERS_FILE = _DATA_DIR / "auth_users.json"
_SESSIONS_FILE = _DATA_DIR / "auth_sessions.json"


# ── Persistence helpers ────────────────────────────────────────────────────────

def _load(path: Path) -> dict:
    try:
        return json.loads(path.read_text()) if path.exists() else {}
    except Exception:
        return {}


def _save(path: Path, data: dict) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


def _users() -> Dict[str, dict]:
    return _load(_USERS_FILE)


def _sessions() -> Dict[str, str]:
    return _load(_SESSIONS_FILE)


def _save_users(u: dict) -> None:
    _save(_USERS_FILE, u)


def _save_sessions(s: dict) -> None:
    _save(_SESSIONS_FILE, s)


# ── Pydantic models ────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    email: str
    name: Optional[str] = None


class LoginResponse(BaseModel):
    session_id: str
    user: UserResponse


# ── Auth functions ─────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def create_user(email: str, password: str, name: Optional[str] = None) -> Optional[UserResponse]:
    """Create a new user. Returns None if email already exists."""
    email = email.lower().strip()
    users = _users()
    if email in users:
        return None
    users[email] = {
        "password_hash": _hash_password(password),
        "name": name or email.split("@")[0],
    }
    _save_users(users)
    return UserResponse(email=email, name=users[email]["name"])


def authenticate_user(email: str, password: str) -> Optional[str]:
    """Authenticate user and return session_id. None if invalid."""
    email = email.lower().strip()
    users = _users()
    user = users.get(email)
    if not user or user["password_hash"] != _hash_password(password):
        return None
    session_id = os.urandom(16).hex()
    sessions = _sessions()
    sessions[session_id] = email
    _save_sessions(sessions)
    return session_id


def get_user_from_session(session_id: str) -> Optional[UserResponse]:
    """Get user from session_id."""
    email = _sessions().get(session_id)
    if not email:
        return None
    users = _users()
    user = users.get(email)
    if not user:
        return None
    return UserResponse(email=email, name=user["name"])


def logout(session_id: str) -> bool:
    """Invalidate session."""
    sessions = _sessions()
    if session_id in sessions:
        del sessions[session_id]
        _save_sessions(sessions)
        return True
    return False


def create_user_from_oauth(email: str, name: Optional[str] = None) -> UserResponse:
    """
    Create (or return existing) user from Auth0 claims.

    Password is not used for Auth0 users; we store a placeholder password_hash so
    the existing JSON schema remains compatible.
    """
    email = email.lower().strip()
    users = _users()
    if email not in users:
        # Placeholder hash; OAuth flow does not validate passwords.
        placeholder_password = os.urandom(16).hex()
        users[email] = {
            "password_hash": _hash_password(placeholder_password),
            "name": name or email.split("@")[0],
        }
        _save_users(users)
    # Ensure name is at least set (in case first insert had no name).
    if name and users[email].get("name") != name:
        users[email]["name"] = name
        _save_users(users)
    return UserResponse(email=email, name=users[email].get("name"))


def create_session_for_email(email: str) -> str:
    """Create a new backend session_id for an existing email."""
    email = email.lower().strip()
    sessions = _sessions()
    session_id = os.urandom(16).hex()
    sessions[session_id] = email
    _save_sessions(sessions)
    return session_id
