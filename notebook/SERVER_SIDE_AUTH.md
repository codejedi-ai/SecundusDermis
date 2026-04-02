# Server-Side Auth0 Authentication

## Architecture

This implementation uses **pure server-side Auth0 authentication** where:
- **Backend** handles all Auth0 token exchange
- **Frontend** never sees Auth0 tokens
- **Backend creates its own JWT** for frontend consumption
- **HttpOnly cookies** store the backend JWT (secure, XSS-proof)

## Flow Diagram

```
┌─────────────┐
│   User      │
│  clicks     │
│  "Sign In"  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  Frontend calls                 │
│  GET /api/auth/auth0/url        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Backend returns Auth0          │
│  authorization URL              │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Frontend redirects browser to  │
│  Auth0 authorization URL        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  User authenticates with Auth0  │
│  (login page, MFA, etc.)        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Auth0 redirects to backend     │
│  /api/auth/auth0/callback       │
│  with authorization code        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Backend exchanges code for     │
│  Auth0 tokens (server-to-server)│
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Backend verifies Auth0 ID token│
│  extracts email/name            │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Backend creates/updates user   │
│  in local database              │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Backend creates its own JWT    │
│  (signed with backend secret)   │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Backend redirects to frontend  │
│  with HttpOnly JWT cookie       │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Frontend reads user from       │
│  GET /api/auth/me (cookie sent) │
└─────────────────────────────────┘
```

## Key Benefits

1. **No Auth0 tokens in frontend** - Auth0 access/ID tokens never leave the backend
2. **HttpOnly cookies** - JWT is stored securely, inaccessible to JavaScript
3. **Backend controls token format** - Can add custom claims, expiry, etc.
4. **Simpler frontend** - No Auth0 SDK needed in frontend
5. **XSS protection** - Cookies are HttpOnly, can't be stolen via XSS

## Backend Endpoints

### GET /api/auth/auth0/url

Returns Auth0 authorization URL for redirect.

**Response:**
```json
{
  "auth0_url": "https://d273liu.ca.auth0.com/authorize?..."
}
```

### GET /api/auth/auth0/callback

Auth0 callback endpoint. Handles code exchange and creates backend JWT.

**Query Parameters:**
- `code` - Authorization code from Auth0
- `state` - Optional state parameter

**Behavior:**
1. Exchanges code for Auth0 tokens
2. Verifies Auth0 ID token
3. Creates/updates local user
4. Creates backend JWT
5. Redirects to frontend with HttpOnly cookies

### GET /api/auth/me

Returns current authenticated user (from backend JWT).

**Response:**
```json
{
  "email": "user@example.com",
  "name": "User Name"
}
```

### POST /api/auth/logout

Clears JWT cookies.

**Response:**
```json
{
  "status": "logged out"
}
```

## Backend JWT Format

```python
{
  "sub": "user@example.com",
  "email": "user@example.com",
  "name": "User Name",
  "iat": 1234567890,
  "exp": 1234567890 + (7 * 24 * 60 * 60)  # 7 days
}
```

**Signed with:** `BACKEND_JWT_SECRET` (HS256)

**Expiry:** 7 days (configurable)

## Environment Variables

### Backend

```bash
# Auth0 Configuration
AUTH0_DOMAIN=d273liu.ca.auth0.com
AUTH0_CLIENT_ID=G3cUNE1TJgDRlxR5bVbZAOeTss2sAjTT
AUTH0_CLIENT_SECRET=mMFu61vM38UmXkx8_EENNxeY8f6WVC316i_1MdE50_1G7LnzQvp3rRApTU5e5mbY
AUTH0_AUDIENCE=https://d273liu.ca.auth0.com/api/v2/  # Optional
AUTH0_ISSUER=https://d273liu.ca.auth0.com/

# Backend JWT Configuration
BACKEND_JWT_SECRET=your-secret-key-here-min-32-chars
BACKEND_JWT_EXPIRY=604800  # 7 days in seconds
```

### Frontend

No Auth0 configuration needed! Frontend only needs to know backend API URL.

## Auth0 Dashboard Configuration

### Allowed Callback URLs

```
http://localhost:8000/auth/auth0/callback
https://troll-certain-bream.ngrok-free.app/auth/auth0/callback
```

### Allowed Logout URLs

```
http://localhost:5173
https://troll-certain-bream.ngrok-free.app
```

### Allowed Web Origins (CORS)

```
http://localhost:5173
http://localhost:8000
https://troll-certain-bream.ngrok-free.app
```

### Application Type

**Single Page Application (SPA)**

### Grant Types

- ✅ Authorization Code

## Implementation Files

| File | Purpose |
|------|---------|
| `backend/auth0_server.py` | Server-side Auth0 flow implementation |
| `backend/auth0/jwt.py` | Auth0 JWT verification (updated for optional audience) |
| `frontend/src/lib/auth-context.tsx` | Frontend auth context (simplified, no Auth0 SDK) |

## Testing

### 1. Start Backend

```bash
cd /root/SecundusDermis/backend
source .venv/bin/activate
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start Frontend

```bash
cd /root/SecundusDermis/frontend
npm run dev -- --host 0.0.0.0
```

### 3. Test Login

1. Visit `http://localhost:5173`
2. Click "Sign In"
3. Redirected to Auth0
4. Authenticate
5. Redirected back to backend callback
6. Backend sets JWT cookie
7. Redirected to frontend home
8. User info loaded from `/api/auth/me`

### 4. Verify JWT Cookie

In browser DevTools → Application → Cookies:
- `sd_jwt` - Backend JWT (HttpOnly)
- `sd_session_id` - Session ID for backward compatibility

### 5. Test API Calls

All API calls automatically send JWT cookie. Backend extracts user from JWT.

## Migration from Previous Flow

### Old Flow (Frontend Auth0 SDK)

```
Frontend → Auth0 SDK → Auth0 → Frontend gets token → Frontend sends to backend
```

### New Flow (Server-Side)

```
Frontend → Backend → Auth0 → Backend gets token → Backend creates JWT → Frontend gets backend JWT
```

### Changes Required

**Frontend:**
- Removed `@auth0/auth0-spa-js` dependency
- Simplified `auth-context.tsx` (no Auth0 SDK)
- Sign in now calls `/auth/auth0/url` and redirects

**Backend:**
- Added `auth0_server.py` router
- Added httpx dependency
- Backend JWT creation/verification
- Updated JWT verification to make audience optional

## Security Considerations

1. **BACKEND_JWT_SECRET** - Must be kept secret, use strong random value
2. **HTTPS in production** - Cookies must be sent over HTTPS only
3. **Cookie flags** - HttpOnly, SameSite=Lax, Secure (in production)
4. **JWT expiry** - 7 days is reasonable, adjust based on security requirements
5. **Logout** - Clear cookies server-side, not just client-side

## Troubleshooting

### "Invalid state parameter"

Auth0 state mismatch. Ensure redirect_uri is exactly the same in:
- Auth0 dashboard Allowed Callback URLs
- Backend callback route

### "Cookie not set"

Check:
- Backend response includes `Set-Cookie` header
- Frontend URL matches cookie domain
- Browser not blocking third-party cookies

### "JWT verification failed"

- Check `BACKEND_JWT_SECRET` is consistent
- Verify system time is synchronized
- Check JWT expiry time

## Next Steps

1. Test the authentication flow
2. Add refresh token logic (optional, for long-lived sessions)
3. Add role/permission claims to backend JWT
4. Implement rate limiting on auth endpoints
