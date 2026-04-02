# Auth0 Integration - Test Instructions

## Problem Fixed

The callback was stuck on "Signing in..." because:

1. **Backend JWT verification** was requiring `AUTH0_AUDIENCE` which wasn't being sent by Auth0
2. **Frontend callback handling** didn't have proper error handling

## Changes Made

### Backend (`backend/auth0/jwt.py`)
- Made `AUTH0_AUDIENCE` **optional** for JWT verification
- JWT is now verified using JWKS + issuer only (audience skip if not configured)
- Added logging to auth endpoint for debugging

### Frontend (`frontend/src/lib/auth-context.tsx`)
- Added try/catch around `handleRedirectCallback()`
- Added console logging for debugging
- Added error state handling

### Frontend (`frontend/src/main.tsx`)
- Created `AuthCallback` component with retry button
- Shows error message if login takes > 5 seconds

### Frontend (`frontend/src/styles/global.css`)
- Added `--color-warning-light` and `--color-warning-dark` variables

---

## How to Test

### 1. Start Backend

```bash
cd /root/SecundusDermis/backend
source .venv/bin/activate
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

**Watch the logs** for Auth0 authentication messages.

### 2. Start Frontend (separate terminal)

```bash
cd /root/SecundusDermis/frontend
npm install
npm run dev -- --host 0.0.0.0
```

### 3. Test Authentication Flow

1. Open browser to `http://localhost:5173`
2. Click "Sign In" in header
3. You'll be redirected to Auth0 login
4. Log in with your Auth0 credentials
5. Auth0 redirects back to `http://localhost:5173/auth/callback?code=...`
6. Frontend exchanges token with backend
7. Backend creates session and sets cookie
8. Redirected to home page as authenticated user

### 4. Check Backend Logs

You should see:
```
Auth0 login: Received token, verifying...
Auth0 JWT verified: sub=auth0|..., email=your@email.com
Creating/updating user: your@email.com
Session created: abc123...
Auth0 login complete for your@email.com
```

### 5. Verify User Data

After login:
- Check cart (should be empty for new user)
- Start chatting (messages saved to backend)
- Logout and login again → messages should persist

### 6. Test Guest Mode Migration

1. Open incognito/private window
2. Chat as guest (up to 10 messages)
3. Click "Sign in to continue"
4. Complete Auth0 login
5. Guest messages should sync to backend automatically

---

## Troubleshooting

### "Callback URL mismatch" Error

**Fix:** Add `http://localhost:5173/auth/callback` to Auth0 Allowed Callback URLs

1. Go to Auth0 Dashboard → Applications → Your App → Settings
2. Add to **Allowed Callback URLs**:
   ```
   http://localhost:5173/auth/callback
   http://localhost:5173
   ```
3. Click **Save Changes**

### "Invalid token" Error

**Check:**
1. AUTH0_DOMAIN is set correctly in `backend/.env`
2. System time is synchronized (JWT validation is time-sensitive)
3. Auth0 application is configured correctly

### Stuck on "Signing in..."

**Check browser console** (F12) for errors. Common issues:
- Auth0 SDK not loading
- Token exchange failing
- CORS issues

**Fix:** Click "Retry Sign In" button

### Backend Logs Show "Auth0 is not configured"

**Fix:** Ensure `backend/.env` has:
```bash
AUTH0_DOMAIN=d273liu.ca.auth0.com
AUTH0_CLIENT_ID=G3cUNE1TJgDRlxR5bVbZAOeTss2sAjTT
```

---

## Auth0 Dashboard Configuration

### Required Settings

**Application Type:** Single Page Application (SPA)

**Allowed Callback URLs:**
```
http://localhost:5173/auth/callback
http://localhost:5173
http://localhost:80
https://troll-certain-bream.ngrok-free.app/auth/callback
https://troll-certain-bream.ngrok-free.app
```

**Allowed Logout URLs:**
```
http://localhost:5173
http://localhost:80
https://troll-certain-bream.ngrok-free.app
```

**Allowed Web Origins (CORS):**
```
http://localhost:5173
http://localhost:80
https://troll-certain-bream.ngrok-free.app
```

**Grant Types:**
- ✅ Authorization Code
- ✅ Refresh Token

---

## API Endpoints

### GET /api/auth/public-config

Returns Auth0 configuration for frontend:

```json
{
  "auth0_domain": "d273liu.ca.auth0.com",
  "auth0_client_id": "G3cUNE1TJgDRlxR5bVbZAOeTss2sAjTT",
  "auth0_audience": ""
}
```

### POST /api/auth/auth0/login

Exchanges Auth0 token for backend session:

**Request:**
```
Authorization: Bearer <auth0_access_token>
```

**Response:**
```json
{
  "session_id": "abc123...",
  "user": {
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

Sets `sd_session_id` cookie.

### GET /api/auth/me

Returns current authenticated user:

**Request:**
```
session-id: <session_id_from_cookie>
```

**Response:**
```json
{
  "email": "user@example.com",
  "name": "User Name"
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `backend/auth0/jwt.py` | Made audience optional for JWT verification |
| `backend/api.py` | Added logging to auth endpoint |
| `backend/auth_resolve.py` | Use email as storage_key (not session_id) |
| `backend/cart.py` | Use email as key (not session_id) |
| `backend/conversations.py` | Use email as key (not session_id) |
| `frontend/src/lib/auth-context.tsx` | Better error handling + guest sync |
| `frontend/src/lib/convo-context.tsx` | Guest mode with 10 message limit |
| `frontend/src/components/ChatWidget.tsx` | Guest warning UI |
| `frontend/src/main.tsx` | AuthCallback component |
| `frontend/src/styles/global.css` | Warning color variables |
| `frontend/src/styles/chat.css` | Guest warning styles |

---

## Next Steps

1. Test the authentication flow locally
2. Verify guest messages sync on login
3. Verify cart/data persists across login methods
4. Deploy to production (update Auth0 URLs for production domain)
