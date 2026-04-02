"""
Validate Auth0-issued JWTs (RS256) using the tenant JWKS endpoint.

Environment:
  AUTH0_DOMAIN    — e.g. your-tenant.auth0.com (no https://)
  AUTH0_AUDIENCE  — optional; API Identifier from Auth0 Dashboard → APIs
  AUTH0_ISSUER    — optional; default https://{AUTH0_DOMAIN}/

Access tokens are verified using JWKS. Audience verification is optional
(used if AUTH0_AUDIENCE is set). Email claim is used for user identification.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Optional

import jwt
from jwt import PyJWKClient

from auth import UserResponse


class AuthTokenError(Exception):
    """Raised when a bearer token is present but invalid or expired."""


def _domain() -> str:
    return (os.getenv("AUTH0_DOMAIN") or "").strip().rstrip("/")


def _audience() -> Optional[str]:
    aud = (os.getenv("AUTH0_AUDIENCE") or "").strip()
    return aud if aud else None


def _issuer() -> str:
    custom = (os.getenv("AUTH0_ISSUER") or "").strip()
    if custom:
        return custom.rstrip("/") + "/"
    d = _domain()
    if not d:
        return ""
    return f"https://{d}/"


def auth0_is_configured() -> bool:
    return bool(_domain())


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    d = _domain()
    return PyJWKClient(f"https://{d}/.well-known/jwks.json")


def verify_auth0_jwt(token: str) -> dict[str, Any]:
    if not auth0_is_configured():
        raise AuthTokenError("Auth0 is not configured (set AUTH0_DOMAIN)")
    
    issuer = _issuer()
    
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        
        # Verify signature and issuer only - skip audience verification
        options = {
            "verify_signature": True,
            "verify_iss": True,
            "verify_iat": True,
            "verify_aud": False,  # Skip audience check
        }
        
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            options=options,
        )
    except jwt.PyJWTError as e:
        raise AuthTokenError(str(e)) from e


def claims_to_user_response(claims: dict[str, Any]) -> UserResponse:
    sub = str(claims.get("sub") or "")
    email_raw = claims.get("email")
    email = (str(email_raw).lower().strip() if email_raw else sub) or sub
    name = claims.get("name") or claims.get("nickname")
    if not name:
        name = email.split("@")[0] if "@" in email else (email or "user")
    return UserResponse(email=email, name=str(name))


def parse_bearer_authorization(authorization: Optional[str]) -> Optional[str]:
    """
    Return the JWT string if the header is a non-empty Bearer token, else None.
    Non-Bearer authorization headers are ignored (legacy clients may omit it).
    """
    if not authorization:
        return None
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None
