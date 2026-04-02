"""
Simple file-backed authentication for SecundusDermis.
Users and sessions persisted to JSON files — survive backend restarts.
"""

import hashlib
import json
import os
import secrets
import time
from pathlib import Path
from typing import Optional, Dict
from pydantic import BaseModel

_DATA_DIR = Path(os.getenv("AUTH_DATA_DIR", Path(__file__).parent / "data"))
_USERS_FILE = _DATA_DIR / "auth_users.json"
_SESSIONS_FILE = _DATA_DIR / "auth_sessions.json"
_RESET_TOKENS_FILE = _DATA_DIR / "auth_reset_tokens.json"


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


def _reset_tokens() -> Dict[str, dict]:
    """Load password reset tokens."""
    return _load(_RESET_TOKENS_FILE)


def _save_users(u: dict) -> None:
    _save(_USERS_FILE, u)


def _save_sessions(s: dict) -> None:
    _save(_SESSIONS_FILE, s)


def _save_reset_tokens(t: dict) -> None:
    _save(_RESET_TOKENS_FILE, t)


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


class PasswordReset(BaseModel):
    token: str
    new_password: str
    email: Optional[str] = None  # Optional - token identifies the user


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


def create_reset_token(email: str) -> Optional[str]:
    """
    Create a password reset token for the given email.
    Returns token if email exists, None otherwise.
    Token expires in 1 hour.
    """
    email = email.lower().strip()
    users = _users()
    
    if email not in users:
        return None  # Don't reveal if email exists
    
    # Generate secure token
    token = secrets.token_urlsafe(32)
    
    # Store token with expiry
    tokens = _reset_tokens()
    tokens[token] = {
        "email": email,
        "expires_at": time.time() + 3600,  # 1 hour
    }
    _save_reset_tokens(tokens)
    
    return token


def verify_reset_token(token: str) -> Optional[str]:
    """
    Verify a reset token and return the associated email.
    Returns None if token is invalid or expired.
    """
    tokens = _reset_tokens()
    token_data = tokens.get(token)
    
    if not token_data:
        return None
    
    # Check expiry
    if time.time() > token_data.get("expires_at", 0):
        # Clean up expired token
        del tokens[token]
        _save_reset_tokens(tokens)
        return None
    
    return token_data.get("email")


def reset_password(token: str, new_password: str) -> bool:
    """
    Reset password using a valid token.
    Returns True if successful, False otherwise.
    """
    email = verify_reset_token(token)
    
    if not email:
        return False
    
    # Update password
    users = _users()
    users[email]["password_hash"] = _hash_password(new_password)
    _save_users(users)
    
    # Invalidate the token
    tokens = _reset_tokens()
    if token in tokens:
        del tokens[token]
        _save_reset_tokens(tokens)
    
    # Invalidate all sessions for this user
    sessions = _sessions()
    sessions_to_remove = [sid for sid, em in sessions.items() if em == email]
    for sid in sessions_to_remove:
        del sessions[sid]
    _save_sessions(sessions)
    
    return True
