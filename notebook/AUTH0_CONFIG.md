# Auth0 Configuration Guide

## Overview

Secundus Dermis uses Auth0 for authentication. This document covers the required configuration in the Auth0 dashboard and local environment setup.

---

## Environment Variables

### Backend (`.env` and `backend/.env`)

```bash
# Auth0 Configuration
AUTH0_DOMAIN=d273liu.ca.auth0.com
AUTH0_AUDIENCE=https://d273liu.ca.auth0.com/api/v2/
AUTH0_ISSUER=https://d273liu.ca.auth0.com/
AUTH0_CLIENT_ID=G3cUNE1TJgDRlxR5bVbZAOeTss2sAjTT
AUTH0_CLIENT_SECRET=mMFu61vM38UmXkx8_EENNxeY8f6WVC316i_1MdE50_1G7LnzQvp3rRApTU5e5mbY
```

### Docker Compose (`docker-compose.local.yml`)

The backend service must receive these environment variables:

```yaml
services:
  backend:
    environment:
      AUTH0_DOMAIN: d273liu.ca.auth0.com
      AUTH0_AUDIENCE: https://d273liu.ca.auth0.com/api/v2/
      AUTH0_ISSUER: https://d273liu.ca.auth0.com/
      AUTH0_CLIENT_ID: G3cUNE1TJgDRlxR5bVbZAOeTss2sAjTT
      AUTH0_CLIENT_SECRET: mMFu61vM38UmXkx8_EENNxeY8f6WVC316i_1MdE50_1G7LnzQvp3rRApTU5e5mbY
```

---

## Auth0 Dashboard Configuration

### Step 1: Navigate to Application Settings

1. Log in to [Auth0 Dashboard](https://manage.auth0.com/)
2. Go to **Applications** → **Applications**
3. Click on your application (e.g., "Secundus Dermis" or the default app)
4. Click **Settings** tab
5. Scroll to **Application URIs** section

### Step 2: Configure Allowed Callback URLs

Add the following URLs to **Allowed Callback URLs**:

```
http://localhost:5173/auth/callback
http://localhost:80/auth/callback
http://localhost:3000/auth/callback
https://troll-certain-bream.ngrok-free.app/auth/callback
```

> **Note:** Use comma-separated values in the Auth0 UI.

### Step 3: Configure Allowed Logout URLs

Add the following URLs to **Allowed Logout URLs**:

> ⚠️ **Important:** Each URL must be a valid URI with protocol (`http://` or `https://`). Do not omit the protocol.

```
http://localhost:5173
http://localhost:80
http://localhost:3000
https://troll-certain-bream.ngrok-free.app
```

### Step 4: Configure Allowed Web Origins

Add the following URLs to **Allowed Web Origins** (CORS):

> ⚠️ **Important:** Each URL must be a valid URI with protocol (`http://` or `https://`).

```
http://localhost:5173
http://localhost:80
http://localhost:3000
https://troll-certain-bream.ngrok-free.app
```

### Step 5: Save Changes

Click **Save Changes** at the bottom of the page.

---

## Auth0 Application Type Settings

Ensure your Auth0 application is configured as follows:

| Setting | Value |
|---------|-------|
| **Application Type** | Single Page Application (SPA) |
| **Token Endpoint Authentication Method** | None (PKCE) |
| **OIDC Conformant** | Enabled |

### Grant Types

Enable the following grant types:
- ✅ Authorization Code
- ✅ Refresh Token

---

## Auth0 API Configuration (Optional)

If using a custom API audience:

1. Go to **Applications** → **APIs**
2. Click **Create API**
3. Set:
   - **Name:** Secundus Dermis API
   - **Identifier:** `https://d273liu.ca.auth0.com/api/v2/`
   - **Signing Algorithm:** RS256
4. Under **Permissions**, add any custom permissions if needed

---

## Frontend Configuration

### Auth0 Client Initialization

The frontend loads Auth0 config from the backend endpoint:

```
GET /api/auth/public-config
```

Response:
```json
{
  "auth0_domain": "d273liu.ca.auth0.com",
  "auth0_client_id": "G3cUNE1TJgDRlxR5bVbZAOeTss2sAjTT",
  "auth0_audience": "https://d273liu.ca.auth0.com/api/v2/"
}
```

### Callback Route

The frontend must have a route to handle Auth0 callback:

```tsx
// main.tsx or App.tsx
<Route
  path="/auth/callback"
  element={
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Signing in...</p>
    </div>
  }
/>
```

The `auth-context.tsx` handles the callback logic:

```tsx
if (window.location.pathname === '/auth/callback') {
  await createBackendSessionFromAuth0();
  window.history.replaceState({}, document.title, '/');
}
```

---

## Authentication Flow

```
┌─────────────┐
│   User      │
│  visits     │
│  /sign-in   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  Frontend calls                 │
│  /api/auth/public-config        │
│  Gets Auth0 domain & client ID  │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Frontend redirects to Auth0    │
│  loginWithRedirect()            │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  User authenticates with Auth0  │
│  (email/password, social, etc.) │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Auth0 redirects back to        │
│  /auth/callback with code       │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Frontend exchanges code for    │
│  token via handleRedirectCallback│
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Frontend sends token to        │
│  POST /api/auth/auth0/login     │
│  with Authorization: Bearer     │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Backend verifies JWT with      │
│  Auth0 JWKS endpoint            │
│  Creates local session          │
│  Sets sd_session_id cookie      │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  User authenticated - redirect  │
│  to home page                   │
└─────────────────────────────────┘
```

---

## Troubleshooting

### "Callback URL mismatch" Error

**Problem:** The redirect URI sent to Auth0 is not in the allowed list.

**Solution:**
1. Check the browser console for the exact callback URL being used
2. Add that URL to **Allowed Callback URLs** in Auth0
3. Ensure the URL matches exactly (including protocol and port)

### "Invalid token" or "JWT verification failed"

**Problem:** Backend cannot verify the Auth0 token.

**Solution:**
1. Verify `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, and `AUTH0_ISSUER` are correct
2. Check that the audience in Auth0 API settings matches `AUTH0_AUDIENCE`
3. Ensure system time is synchronized (JWT validation is time-sensitive)

### Auth0 Not Redirecting

**Problem:** Clicking sign-in does nothing.

**Solution:**
1. Check browser console for JavaScript errors
2. Verify `/api/auth/public-config` returns valid config
3. Ensure Auth0 SDK is loaded (`@auth0/auth0-spa-js`)

### Session Not Persisting

**Problem:** User logged in but session lost on refresh.

**Solution:**
1. Check that `sd_session_id` cookie is being set
2. Verify cookie `SameSite` and `Secure` flags match your deployment
3. Check `auth-context.tsx` bootstrap logic on mount

---

## Local Development Commands

### Start Backend

```bash
cd /root/SecundusDermis/backend
source .venv/bin/activate
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

### Start Frontend

```bash
cd /root/SecundusDermis/frontend
npm install
npm run dev -- --host 0.0.0.0
```

### Access Points

| Environment | URL |
|-------------|-----|
| Frontend (dev) | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Auth Config | http://localhost:8000/auth/public-config |

---

## Security Notes

- Never commit `.env` files with real credentials to version control
- Rotate `AUTH0_CLIENT_SECRET` periodically
- Use separate Auth0 applications for development and production
- Enable MFA for production Auth0 tenant
- Review Auth0 logs regularly for suspicious activity

---

## Guest Mode (Anonymous Users)

### Overview

Secundus Dermis supports **guest mode** for anonymous users:
- Messages stored in `localStorage` for **2 days**
- Limited to **10 messages** before requiring sign-in
- On sign-in, all guest messages are **automatically synced** to the backend

### Guest Mode Behavior

| Feature | Guest User | Authenticated User |
|---------|-----------|-------------------|
| Message storage | localStorage | Backend + localStorage cache |
| Message limit | 10 messages | Unlimited |
| Data expiry | 2 days | Persistent |
| Cart | Email-keyed (shared on login) | Email-keyed |
| Conversations | localStorage → backend on login | Backend |

### Guest Data Migration

When a guest user signs in with Auth0:

1. Frontend detects guest messages in `localStorage` (`sd_chat_messages_anon`)
2. After Auth0 redirect callback, frontend syncs all guest messages to backend
3. Backend appends messages to the user's conversation history (keyed by email)
4. Guest localStorage data is cleared after successful sync

### Implementation Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/convo-context.tsx` | Guest mode state, message limit, expiry |
| `frontend/src/lib/auth-context.tsx` | Sync guest messages on login |
| `frontend/src/components/ChatWidget.tsx` | Guest warning UI |
| `backend/conversations.py` | Email-keyed conversation store |

### Guest Mode Constants

```typescript
// convo-context.tsx
export const GUEST_MESSAGE_LIMIT = 10;
const GUEST_STORAGE_EXPIRY_DAYS = 2;
```

### Guest Warning UI

When guest reaches message limit:
```
┌────────────────────────────────────────────────┐
│ ✨ You've reached the guest message limit (10) │
│                    [Sign in to continue]       │
└────────────────────────────────────────────────┘
```

Progress indicator (before limit):
```
┌────────────────────────────────────────────────┐
│ Guest mode: 7/10 messages   [Sign in to save] │
└────────────────────────────────────────────────┘
```

---

## User Data Migration Strategy

### Email-Based Storage Key

Secundus Dermis uses **email address** as the storage key for all user data (cart, conversations, profile). This ensures:

1. **Seamless Migration**: When a user signs in with Auth0 using the same email as their local account, they retain all their data
2. **Cross-Method Continuity**: Users can switch between local login and Auth0 login without losing cart items or conversation history
3. **No Data Duplication**: Same email = same data, regardless of authentication method

### Storage Key Resolution

The `auth_resolve.py` module handles authentication resolution:

```python
@dataclass(frozen=True)
class ResolvedAuth:
    storage_key: str  # email address (normalized, lowercase)
    user: UserResponse
    auth0_sub: Optional[str] = None  # Auth0 subject ID for reference
```

**Flow:**
1. **Auth0 Login**: Backend extracts email from JWT claims → uses email as `storage_key`
2. **Local Session**: Backend looks up email from session_id → uses email as `storage_key`
3. **Data Access**: Cart, conversations, and profile all use `resolved.storage_key` (email)

### User Account Merging

The `create_user_from_oauth()` function in `auth.py` handles account creation:

```python
def create_user_from_oauth(email: str, name: Optional[str] = None) -> UserResponse:
    email = email.lower().strip()
    users = _users()
    if email not in users:
        # Create new user for Auth0 email
        users[email] = { ... }
    # If user already exists, return existing user (no duplication)
    return UserResponse(email=email, name=users[email].get("name"))
```

**Result:**
- Existing local users who sign in with Auth0 using the same email **keep their account**
- New Auth0 users get a new account created automatically
- All data (cart, conversations, profile) is shared by email

### Data Stores Using Email Key

| Module | Storage | Key Type |
|--------|---------|----------|
| `cart.py` | In-memory dict | `email` |
| `conversations.py` | In-memory dict | `email` |
| `user_profiles.py` | In-memory dict | `email` |
| `auth.py` | JSON file | `email` (lowercase) |

---

## References

- [Auth0 SPA SDK Docs](https://auth0.com/docs/libraries/auth0-spa-js)
- [Auth0 Quickstart for React](https://auth0.com/docs/quickstart/spa/react)
- [Auth0 Token Validation](https://auth0.com/docs/tokens/access-tokens/validate-access-tokens)
- [Auth0 Application Settings](https://auth0.com/docs/applications/configure-application-settings)
