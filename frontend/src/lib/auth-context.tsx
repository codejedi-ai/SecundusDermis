/**
 * Auth context for server-side Auth0 authentication.
 *
 * Flow:
 * 1. Frontend calls GET /auth/auth0/url to get Auth0 authorization URL
 * 2. Frontend redirects user to that URL
 * 3. User authenticates with Auth0
 * 4. Auth0 callbacks to backend /auth/auth0/callback
 * 5. Backend exchanges code for tokens, creates backend JWT
 * 6. Backend redirects to frontend with HttpOnly JWT cookie
 * 7. Frontend reads user info from /auth/me (cookie sent automatically)
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from './api-base';

export interface User {
  email: string;
  name: string;
}

export interface Session {
  session_id: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SESSION_COOKIE = 'sd_session_id';
const JWT_COOKIE = 'sd_jwt';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

async function syncLocalMessagesToBackend(sessionId: string, userEmail: string) {
  try {
    // Sync guest messages (anon) to backend when user logs in
    const guestMessagesKey = 'sd_chat_messages_anon';
    const raw = localStorage.getItem(guestMessagesKey);
    if (!raw) return;

    const messages = JSON.parse(raw) as Array<{
      role: string;
      content: string;
      timestamp: number;
    }>;

    console.log(`[auth-context] Syncing ${messages.length} guest messages to backend for ${userEmail}`);

    for (const msg of messages) {
      if (msg.role === 'init') continue;
      await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'session-id': sessionId },
        body: JSON.stringify({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }),
        credentials: 'include',
      });
    }

    // Clear guest data after successful sync
    localStorage.removeItem(guestMessagesKey);
    localStorage.removeItem('sd_chat_session_anon');
    localStorage.removeItem('sd_chat_guest_expiry');
    console.log('[auth-context] Guest data synced and cleared');
  } catch (err) {
    console.warn('[auth-context] Failed to sync local messages:', err);
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const auth0InitPromiseRef = useRef<Promise<void> | null>(null);

  // Get Auth0 URL from backend and redirect
  async function getAuth0UrlAndRedirect(): Promise<void> {
    if (auth0InitPromiseRef.current) return auth0InitPromiseRef.current;
    
    auth0InitPromiseRef.current = (async () => {
      try {
        console.log('[auth-context] Fetching Auth0 URL from backend...');
        const res = await fetch(`${API_BASE}/auth/auth0/url`, { credentials: 'include' });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[auth-context] Failed to get Auth0 URL:', res.status, errorText);
          throw new Error(`Failed to get Auth0 URL: ${res.status} ${errorText}`);
        }
        
        const data = await res.json() as { auth0_url: string };
        console.log('[auth-context] Got Auth0 URL, redirecting...', data.auth0_url);
        
        // Redirect to Auth0 (via backend)
        window.location.href = data.auth0_url;
      } catch (err) {
        console.error('[auth-context] Auth0 redirect error:', err);
        alert(`Sign in failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        throw err;
      }
    })();
    
    return auth0InitPromiseRef.current;
  }

  async function bootstrapFromBackendSession() {
    // Only check backend if we have a cookie (avoids 401 in console for new visitors)
    const hasCookie = getCookie(SESSION_COOKIE) || getCookie(JWT_COOKIE);
    if (!hasCookie) {
      return false;
    }
    
    // Try to get user from backend JWT (cookie sent automatically)
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });

      if (!res.ok) {
        return false;
      }

      const u = (await res.json()) as User;
      
      // Get session_id from cookie for backward compatibility
      const sessionId = getCookie(SESSION_COOKIE) || 'jwt-auth';
      
      setUser(u);
      setSession({ session_id: sessionId, user: u });
      return true;
    } catch (err) {
      // Silently fail - user is not logged in
      return false;
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Clear any stale localStorage data from old auth system
      try {
        const oldSessionKey = 'sd_session_id';
        const oldSession = localStorage.getItem(oldSessionKey);
        if (oldSession) {
          console.log('[auth-context] Clearing stale localStorage session');
          localStorage.removeItem(oldSessionKey);
        }
      } catch {
        // Ignore localStorage errors
      }
      
      // Only try to restore session if we have cookies
      await bootstrapFromBackendSession();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = async () => {
    console.log('[auth-context] signIn() called');
    await getAuth0UrlAndRedirect();
    // The window.location.href assignment in getAuth0UrlAndRedirect will redirect
  };

  const signOut = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }

    deleteCookie(SESSION_COOKIE);
    deleteCookie(JWT_COOKIE);
    setSession(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, session, isLoading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
