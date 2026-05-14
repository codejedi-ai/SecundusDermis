"""
Authentication for SecundusDermis.

Users: JSON files (default) or Notion database rows (AUTH_USERS_BACKEND=notion).
Sessions / reset / verify tokens remain file-backed in both modes.
"""

import hashlib
import json
import os
import secrets
import time
import warnings
from pathlib import Path
from typing import Dict, Optional, Tuple

import config
from pydantic import BaseModel


class UsersStorageFullError(Exception):
    """Notion users DB has no row with an empty Email (no free slot)."""


def _notion_users_active() -> bool:
    mode = os.getenv("AUTH_USERS_BACKEND", "file").lower()
    if mode not in ("notion", "notion_users"):
        return False
    import notion_users as _nu

    if not _nu.is_configured():
        raise RuntimeError(
            "AUTH_USERS_BACKEND=notion requires NOTION_TOKEN and NOTION_USERS_DATABASE_ID."
        )
    return True


def _paths_equal(a: Path, b: Path) -> bool:
    ra, rb = a.resolve(), b.resolve()
    if ra == rb:
        return True
    try:
        return ra.samefile(rb)
    except OSError:
        return False


_raw_auth = os.getenv("AUTH_DATA_DIR", "").strip()
if not _raw_auth:
    _DATA_DIR = config.DATA_DIR
else:
    _p = Path(_raw_auth).expanduser()
    _candidate = _p.resolve() if _p.is_absolute() else (Path(__file__).resolve().parent / _p).resolve()
    if _paths_equal(_candidate, config.DATA_DIR):
        _DATA_DIR = config.DATA_DIR
    else:
        warnings.warn(
            f"AUTH_DATA_DIR={_raw_auth!r} resolves to {_candidate}; "
            f"using config.DATA_DIR ({config.DATA_DIR!r}) so auth files stay with app data.",
            UserWarning,
            stacklevel=1,
        )
        _DATA_DIR = config.DATA_DIR
_USERS_FILE = _DATA_DIR / "auth_users.json"
_SESSIONS_FILE = _DATA_DIR / "auth_sessions.json"
_RESET_TOKENS_FILE = _DATA_DIR / "auth_reset_tokens.json"
_VERIFY_TOKENS_FILE = _DATA_DIR / "auth_verify_tokens.json"


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


def _verify_tokens() -> Dict[str, dict]:
    return _load(_VERIFY_TOKENS_FILE)


def _save_users(u: dict) -> None:
    _save(_USERS_FILE, u)


def _save_sessions(s: dict) -> None:
    _save(_SESSIONS_FILE, s)


def _save_reset_tokens(t: dict) -> None:
    _save(_RESET_TOKENS_FILE, t)


def _save_verify_tokens(t: dict) -> None:
    _save(_VERIFY_TOKENS_FILE, t)


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


class ProfileUpdate(BaseModel):
    name: Optional[str] = None


class VerifyEmailRequest(BaseModel):
    token: str


class RegisterResponse(BaseModel):
    email: str
    name: Optional[str] = None
    message: str
    verification_token: Optional[str] = None
    verify_url: Optional[str] = None


# ── Auth functions ─────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _issue_email_verification_token(email: str) -> str:
    """Replace any existing verification token for this email; return new token."""
    email = email.lower().strip()
    token = secrets.token_urlsafe(32)
    vk = _verify_tokens()
    vk = {t: v for t, v in vk.items() if v.get("email") != email}
    vk[token] = {
        "email": email,
        "expires_at": time.time() + 48 * 3600,  # 48 hours
    }
    _save_verify_tokens(vk)
    return token


def create_user(email: str, password: str, name: Optional[str] = None) -> Optional[Tuple[UserResponse, str]]:
    """
    Create a new unverified user and issue an email verification token.
    Returns (user, verification_token) or None if email already exists.
    Notion mode: fills an existing empty row only (never creates pages).
    """
    email = email.lower().strip()
    display_name = name or email.split("@")[0]
    if _notion_users_active():
        import notion_users as nu

        if nu.get_user_record(email):
            return None
        try:
            nu.claim_empty_row_and_fill(
                email,
                _hash_password(password),
                display_name,
                email_verified=False,
            )
        except nu.NotionUsersFullError as e:
            raise UsersStorageFullError(str(e)) from e
        verify_token = _issue_email_verification_token(email)
        return UserResponse(email=email, name=display_name), verify_token

    users = _users()
    if email in users:
        return None
    users[email] = {
        "password_hash": _hash_password(password),
        "name": display_name,
        "email_verified": False,
    }
    _save_users(users)
    verify_token = _issue_email_verification_token(email)
    return UserResponse(email=email, name=users[email]["name"]), verify_token


def try_authenticate(
    email: str, password: str
) -> Tuple[Optional[str], Optional[str]]:
    """
    Check password and create session if verified.
    Returns (session_id, error): error is None on success, or one of:
    ``user_not_found``, ``invalid_password``, ``email_not_verified``.
    """
    email = email.lower().strip()
    password = (password or "").rstrip("\r\n")
    if _notion_users_active():
        import notion_users as nu

        user = nu.get_user_record(email)
        if not user:
            return None, "user_not_found"
        if user["password_hash"] != _hash_password(password):
            return None, "invalid_password"
        if not user.get("email_verified", True):
            return None, "email_not_verified"
    else:
        users = _users()
        user = users.get(email)
        if not user:
            return None, "user_not_found"
        if user["password_hash"] != _hash_password(password):
            return None, "invalid_password"
        if not user.get("email_verified", True):
            return None, "email_not_verified"
    session_id = os.urandom(16).hex()
    sessions = _sessions()
    sessions[session_id] = email
    _save_sessions(sessions)
    return session_id, None


def authenticate_user(email: str, password: str) -> Optional[str]:
    """Backward-compatible: session_id or None (does not expose unverified vs wrong-password)."""
    sid, err = try_authenticate(email, password)
    if err:
        return None
    return sid


def verify_email_token(token: str) -> bool:
    """Mark user's email verified if token is valid; returns False otherwise."""
    vk = _verify_tokens()
    token_data = vk.get(token)
    if not token_data:
        return False
    if time.time() > token_data.get("expires_at", 0):
        del vk[token]
        _save_verify_tokens(vk)
        return False
    email = token_data.get("email")
    if not email:
        return False
    email = email.lower().strip()
    if _notion_users_active():
        import notion_users as nu

        if not nu.get_user_record(email):
            return False
        if not nu.update_user_verified(email, True):
            return False
    else:
        users = _users()
        if email not in users:
            return False
        users[email]["email_verified"] = True
        _save_users(users)
    del vk[token]
    _save_verify_tokens(vk)
    return True


def resend_verification_token(email: str) -> Optional[str]:
    """
    If the account exists and is not verified, issue a new token and return it.
    Returns None if user missing or already verified.
    """
    email = email.lower().strip()
    if _notion_users_active():
        import notion_users as nu

        user = nu.get_user_record(email)
        if not user:
            return None
        if user.get("email_verified", True):
            return None
    else:
        users = _users()
        user = users.get(email)
        if not user:
            return None
        if user.get("email_verified", True):
            return None
    return _issue_email_verification_token(email)


def get_user_from_session(session_id: str) -> Optional[UserResponse]:
    """Get user from session_id."""
    email = _sessions().get(session_id)
    if not email:
        return None
    email = email.lower().strip()
    if _notion_users_active():
        import notion_users as nu

        user = nu.get_user_record(email)
        if not user:
            return None
        return UserResponse(email=email, name=user.get("name") or email.split("@")[0])
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


def get_user_by_email(email: str) -> Optional[UserResponse]:
    """Get user profile by email."""
    email = email.lower().strip()
    if _notion_users_active():
        import notion_users as nu

        user = nu.get_user_record(email)
        if not user:
            return None
        return UserResponse(email=email, name=user.get("name") or email.split("@")[0])
    users = _users()
    user = users.get(email)
    if not user:
        return None
    return UserResponse(email=email, name=user.get("name"))


def create_reset_token(email: str) -> Optional[str]:
    """
    Create a password reset token for the given email.
    Returns token if email exists, None otherwise.
    Token expires in 1 hour.
    """
    email = email.lower().strip()
    if _notion_users_active():
        import notion_users as nu

        if not nu.get_user_record(email):
            return None
    else:
        users = _users()
        if email not in users:
            return None
    
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

    if _notion_users_active():
        import notion_users as nu

        if not nu.update_password_hash_for_email(email, _hash_password(new_password)):
            return False
    else:
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


def update_user_profile(email: str, name: Optional[str] = None) -> Optional[UserResponse]:
    """
    Update user profile fields (currently just name).
    Returns updated UserResponse or None if user not found.
    """
    email = email.lower().strip()
    if _notion_users_active():
        import notion_users as nu

        if not nu.get_user_record(email):
            return None
        if name is not None:
            nu.update_user_name(email, name)
        user = nu.get_user_record(email)
        return UserResponse(
            email=email, name=(user or {}).get("name") or email.split("@")[0]
        )
    users = _users()
    user = users.get(email)
    if not user:
        return None
    if name is not None:
        users[email]["name"] = name
        _save_users(users)
    return UserResponse(email=email, name=users[email].get("name"))
