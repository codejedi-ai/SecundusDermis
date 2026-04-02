"""
Resolve an authenticated user from either Auth0 Bearer JWT or legacy session-id header.

Storage Key Strategy:
- Uses email as the storage_key for both Auth0 and local sessions
- This ensures users with the same email share cart/conversation data
- Auth0 sub is stored in user metadata but not used for data partitioning
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException

from auth import UserResponse, get_user_from_session
from auth0 import (
    AuthTokenError,
    auth0_is_configured,
    claims_to_user_response,
    parse_bearer_authorization,
    verify_auth0_jwt,
)


@dataclass(frozen=True)
class ResolvedAuth:
    """
    storage_key: Uses email for both Auth0 and local sessions to share data.
    user: UserResponse with email and name.
    auth0_sub: Optional Auth0 subject ID for reference.
    """
    storage_key: str  # email address (normalized, lowercase)
    user: UserResponse
    auth0_sub: Optional[str] = None  # Auth0 sub if logged in via Auth0


def resolve_auth(
    authorization: Optional[str],
    session_id: Optional[str],
) -> Optional[ResolvedAuth]:
    bearer = parse_bearer_authorization(authorization)
    if bearer is not None:
        if not auth0_is_configured():
            raise HTTPException(
                status_code=503,
                detail="Bearer token sent but AUTH0_DOMAIN and AUTH0_AUDIENCE are not set",
            )
        try:
            claims = verify_auth0_jwt(bearer)
        except AuthTokenError as e:
            raise HTTPException(status_code=401, detail=str(e)) from e
        
        user = claims_to_user_response(claims)
        # Use email as storage_key to share data across login methods
        return ResolvedAuth(
            storage_key=user.email.lower().strip(),
            user=user,
            auth0_sub=str(claims.get("sub") or "")
        )

    if session_id:
        user = get_user_from_session(session_id)
        if user:
            # Use email as storage_key for local sessions too
            return ResolvedAuth(
                storage_key=user.email.lower().strip(),
                user=user,
                auth0_sub=None
            )
    return None


async def optional_resolved_auth(
    authorization: Optional[str] = Header(default=None),
    session_id: Optional[str] = Header(default=None, alias="session-id"),
) -> Optional[ResolvedAuth]:
    return resolve_auth(authorization, session_id)


async def require_resolved_auth(
    resolved: Annotated[Optional[ResolvedAuth], Depends(optional_resolved_auth)],
) -> ResolvedAuth:
    if not resolved:
        raise HTTPException(status_code=401, detail="Authentication required")
    return resolved
