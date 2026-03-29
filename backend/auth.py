"""
Simple in-memory authentication for SecundusDermis demo.
No database - users stored in memory only.
"""

import hashlib
import os
from typing import Optional, Dict
from pydantic import BaseModel

# In-memory user store: email -> {password_hash, name}
_users: Dict[str, dict] = {}

# In-memory sessions: session_id -> email
_sessions: Dict[str, str] = {}


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


def _hash_password(password: str) -> str:
    """Simple SHA256 hash (demo only - use bcrypt in production)."""
    return hashlib.sha256(password.encode()).hexdigest()


def create_user(email: str, password: str, name: Optional[str] = None) -> Optional[UserResponse]:
    """Create a new user. Returns None if email already exists."""
    email = email.lower().strip()
    if email in _users:
        return None
    _users[email] = {
        "password_hash": _hash_password(password),
        "name": name or email.split("@")[0],
    }
    return UserResponse(email=email, name=_users[email]["name"])


def authenticate_user(email: str, password: str) -> Optional[str]:
    """Authenticate user and return session_id. None if invalid."""
    email = email.lower().strip()
    user = _users.get(email)
    if not user:
        return None
    if user["password_hash"] != _hash_password(password):
        return None
    # Create session
    session_id = os.urandom(16).hex()
    _sessions[session_id] = email
    return session_id


def get_user_from_session(session_id: str) -> Optional[UserResponse]:
    """Get user from session_id."""
    email = _sessions.get(session_id)
    if not email or email not in _users:
        return None
    user = _users[email]
    return UserResponse(email=email, name=user["name"])


def logout(session_id: str) -> bool:
    """Invalidate session."""
    if session_id in _sessions:
        del _sessions[session_id]
        return True
    return False
