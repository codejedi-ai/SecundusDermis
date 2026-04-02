"""
Server-side Auth0 authentication flow.

Backend handles all Auth0 token exchange:
1. Frontend redirects user to /auth/auth0/authorize (backend returns Auth0 URL)
2. User authenticates with Auth0
3. Auth0 redirects to /auth/auth0/callback with code
4. Backend exchanges code for tokens
5. Backend creates its own JWT for the frontend
6. Frontend only knows about backend JWT (not Auth0 tokens)
"""

import os
import hashlib
import time
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.responses import RedirectResponse as StarletteRedirectResponse

from auth import create_user_from_oauth, create_session_for_email, _hash_password
from auth0.jwt import verify_auth0_jwt, claims_to_user_response, _domain, _issuer, _audience, _jwks_client

router = APIRouter(prefix="/auth", tags=["auth"])

# Auth0 configuration
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID", "")
AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")
AUTH0_ISSUER = os.getenv("AUTH0_ISSUER", "")

# Backend JWT secret (for signing our own tokens)
BACKEND_JWT_SECRET = os.getenv("BACKEND_JWT_SECRET", os.urandom(32).hex())
BACKEND_JWT_ALGORITHM = "HS256"
BACKEND_JWT_EXPIRY = 7 * 24 * 60 * 60  # 7 days


def _create_backend_jwt(email: str, name: str) -> str:
    """Create a simple backend-signed JWT for the user."""
    import jwt
    
    payload = {
        "sub": email,
        "email": email,
        "name": name,
        "iat": int(time.time()),
        "exp": int(time.time()) + BACKEND_JWT_EXPIRY,
    }
    
    token = jwt.encode(
        payload,
        BACKEND_JWT_SECRET,
        algorithm=BACKEND_JWT_ALGORITHM
    )
    return token


def _verify_backend_jwt(token: str) -> Optional[dict]:
    """Verify backend-signed JWT."""
    import jwt
    
    try:
        payload = jwt.decode(
            token,
            BACKEND_JWT_SECRET,
            algorithms=[BACKEND_JWT_ALGORITHM]
        )
        return payload
    except jwt.PyJWTError:
        return None


def _get_auth0_authorize_url(redirect_uri: str) -> str:
    """Generate Auth0 authorization URL."""
    params = {
        "response_type": "code",
        "client_id": AUTH0_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": "openid profile email",
    }
    
    if AUTH0_AUDIENCE:
        params["audience"] = AUTH0_AUDIENCE
    
    base_url = f"https://{AUTH0_DOMAIN}/authorize"
    return f"{base_url}?{urlencode(params)}"


async def _exchange_code_for_tokens(code: str, redirect_uri: str) -> dict:
    """Exchange Auth0 authorization code for tokens."""
    token_url = f"https://{AUTH0_DOMAIN}/oauth/token"
    
    data = {
        "grant_type": "authorization_code",
        "client_id": AUTH0_CLIENT_ID,
        "client_secret": AUTH0_CLIENT_SECRET,
        "code": code,
        "redirect_uri": redirect_uri,
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=data)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Auth0 token exchange failed: {response.text}"
            )
        
        return response.json()


@router.get("/auth0/authorize")
async def auth0_authorize(request: Request):
    """
    Initiate Auth0 login flow.
    
    Frontend redirects user here → Backend returns Auth0 authorization URL → 
    User authenticates with Auth0 → Auth0 callbacks to /auth/auth0/callback
    """
    redirect_uri = str(request.url_for("auth0_callback"))
    auth0_url = _get_auth0_authorize_url(redirect_uri)
    
    # Redirect user to Auth0
    return StarletteRedirectResponse(url=auth0_url)


@router.get("/auth0/callback")
async def auth0_callback(request: Request, code: Optional[str] = None, error: Optional[str] = None):
    """
    Auth0 callback endpoint.
    
    Auth0 redirects here with authorization code → 
    Backend exchanges code for tokens →
    Backend creates user + session →
    Backend creates its own JWT →
    Redirects to frontend with backend JWT in cookie
    """
    if error:
        raise HTTPException(status_code=400, detail=f"Auth0 error: {error}")
    
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    
    # Get the redirect_uri we used (must match exactly)
    redirect_uri = str(request.url_for("auth0_callback"))
    
    # Exchange code for tokens
    tokens = await _exchange_code_for_tokens(code, redirect_uri)
    
    id_token = tokens.get("id_token")
    access_token = tokens.get("access_token")
    
    if not id_token:
        raise HTTPException(status_code=400, detail="No ID token from Auth0")
    
    # Verify the ID token
    try:
        claims = verify_auth0_jwt(id_token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid ID token: {str(e)}")
    
    # Extract user info
    email = claims.get("email", "").lower().strip()
    name = claims.get("name", claims.get("nickname", email.split("@")[0]))
    
    if not email:
        raise HTTPException(status_code=400, detail="No email in Auth0 token")
    
    # Create/update user in local database
    create_user_from_oauth(email=email, name=name)
    
    # Create backend session
    session_id = create_session_for_email(email)
    
    # Create backend JWT
    backend_jwt = _create_backend_jwt(email, name)
    
    # Determine where to redirect after login
    # Frontend can specify via 'state' parameter or we use default
    frontend_redirect = "/"
    
    # Create response that redirects to frontend with JWT
    response = StarletteRedirectResponse(url=f"http://localhost:5173{frontend_redirect}")
    
    # Set backend JWT in cookie (HttpOnly for security)
    response.set_cookie(
        key="sd_jwt",
        value=backend_jwt,
        max_age=BACKEND_JWT_EXPIRY,
        httponly=True,
        samesite="lax",
        path="/",
    )
    
    # Also set session_id for backward compatibility
    response.set_cookie(
        key="sd_session_id",
        value=session_id,
        max_age=BACKEND_JWT_EXPIRY,
        httponly=True,
        samesite="lax",
        path="/",
    )
    
    return response


@router.get("/me")
async def get_current_user(sd_jwt: Optional[str] = None):
    """
    Get current authenticated user from backend JWT.
    
    Frontend doesn't need to send anything - JWT is in HttpOnly cookie.
    """
    if not sd_jwt:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    payload = _verify_backend_jwt(sd_jwt)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return {
        "email": payload["email"],
        "name": payload["name"],
    }


@router.post("/logout")
async def logout_endpoint():
    """Logout - clear JWT cookies."""
    response = JSONResponse(content={"status": "logged out"})
    response.delete_cookie(key="sd_jwt", path="/")
    response.delete_cookie(key="sd_session_id", path="/")
    return response


@router.get("/auth0/url")
async def get_auth0_url(request: Request):
    """
    Get Auth0 authorization URL for frontend redirect.
    
    Frontend calls this → gets URL → redirects user → Auth0 callbacks to backend.
    """
    redirect_uri = str(request.url_for("auth0_callback"))
    auth0_url = _get_auth0_authorize_url(redirect_uri)
    
    return {"auth0_url": auth0_url}
