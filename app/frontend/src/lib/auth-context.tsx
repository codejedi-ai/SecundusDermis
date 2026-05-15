/**
 * Auth context using backend API.
 * Session id is issued on login as an HttpOnly ``sd_session_id`` cookie; the SPA restores
 * ``session`` state via ``GET /api/auth/me`` (credentials) which returns ``session_id`` in JSON
 * and re-issues the cookie. A non-HttpOnly ``localStorage`` backup sends ``session-id`` on
 * bootstrap when the cookie is missing (e.g. cross-origin API or preview builds).
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { parseApiErrorDetail } from './api-error';
import { API_BASE } from './api-base';
import { clearHouseAgentKeyCache, fetchHouseAgentKey } from './house-agent-key';
import { isAtelierExperience, parseExperienceMode, type ExperienceMode } from './experience-mode';

// ── Types ──────────────────────────────────────────────────────────────────

export type { ExperienceMode };

export interface User {
  email: string;
  name: string;
  experience_mode: ExperienceMode;
}

export interface Session {
  session_id: string;
  user: User;
}

export interface RegisterResult {
  message: string;
  email: string;
  name?: string | null;
  verificationToken?: string | null;
  verifyUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<RegisterResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ── Cookie helpers ────────────────────────────────────────────────────────

const SESSION_COOKIE = 'sd_session_id';
/** Survives reload; cleared on logout or 401. Lets ``/auth/me`` restore the HttpOnly cookie. */
const SESSION_BACKUP_KEY = 'sd_session_id_backup';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

// ── Sync local messages to backend ────────────────────────────────────────

/** Sync localStorage messages to backend after login. */
async function syncLocalMessagesToBackend(sessionId: string, userEmail: string) {
  try {
    const messagesKey = `sd_chat_messages_${userEmail}`;
    const raw = localStorage.getItem(messagesKey);
    if (!raw) return;
    
    const messages = JSON.parse(raw) as Array<{
      role: string;
      content: string;
      timestamp: number;
    }>;
    
    // Sync each message to backend
    for (const msg of messages) {
      if (msg.role === 'init') continue; // Skip initial message
      
      await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'session-id': sessionId,
        },
        body: JSON.stringify({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }),
        credentials: 'include',
      });
    }
    
    console.log('[auth-context] Synced local messages to backend for', userEmail);
  } catch (err) {
    console.warn('[auth-context] Failed to sync local messages:', err);
  }
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const backup = (() => {
      try {
        return localStorage.getItem(SESSION_BACKUP_KEY)?.trim() || ''
      } catch {
        return ''
      }
    })()
    const headers: Record<string, string> = {}
    if (backup) {
      headers['session-id'] = backup
    }
    fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
      headers: Object.keys(headers).length ? headers : undefined,
    })
      .then((r) => {
        if (!r.ok) {
          if (r.status === 401) {
            try {
              localStorage.removeItem(SESSION_BACKUP_KEY)
            } catch {
              /* ignore */
            }
          }
          deleteCookie(SESSION_COOKIE)
          return null
        }
        return r.json() as Promise<{
          email: string
          name?: string | null
          session_id: string
          experience_mode?: string
        }>
      })
      .then((data) => {
        if (data?.session_id && data.email) {
          try {
            localStorage.setItem(SESSION_BACKUP_KEY, data.session_id)
          } catch {
            /* ignore */
          }
          const u: User = {
            email: data.email,
            name: data.name || '',
            experience_mode: parseExperienceMode(data.experience_mode),
          }
          setSession({ session_id: data.session_id, user: u })
          setUser(u)
          if (!isAtelierExperience(u)) {
            void fetchHouseAgentKey(data.session_id).catch(() => {})
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  // Listen for profile updates from Account page
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{
        email: string
        name?: string | null
        experience_mode?: string
      }>).detail;
      setUser((prev) => {
        if (!prev || prev.email !== detail.email) return prev;
        return {
          ...prev,
          name: detail.name != null ? detail.name || '' : prev.name,
          experience_mode:
            detail.experience_mode === 'atelier' || detail.experience_mode === 'boutique'
              ? detail.experience_mode
              : prev.experience_mode,
        };
      });
    };
    window.addEventListener('sd:user:updated', handler);
    return () => window.removeEventListener('sd:user:updated', handler);
  }, []);

  const signUp = async (email: string, password: string, name?: string): Promise<RegisterResult> => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
      credentials: 'include',
    });
    const raw = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      data = {};
    }
    if (!res.ok) {
      const msg = parseApiErrorDetail(data, raw, 'Registration failed');
      throw new Error(msg);
    }
    return {
      message: (data.message as string) || 'Check your email to verify your account.',
      email: data.email as string,
      name: (data.name as string | null) ?? null,
      verificationToken: (data.verification_token as string | null) ?? null,
      verifyUrl: (data.verify_url as string | null) ?? null,
    };
  };

  const signIn = async (email: string, password: string) => {
    const em = email.trim();
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: em, password }),
      credentials: 'include',
    });
    const raw = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      body = {};
    }
    if (!res.ok) {
      const fallback =
        res.status === 403
          ? 'Please verify your email before signing in. Check your inbox for the verification link.'
          : 'Sign in failed. Check your email and password.';
      throw new Error(parseApiErrorDetail(body, raw, fallback));
    }
    const data = body as {
      session_id: string
      user: { email: string; name?: string | null; experience_mode?: string }
    }
    const user: User = {
      email: data.user.email,
      name: data.user.name || '',
      experience_mode: parseExperienceMode(data.user.experience_mode),
    }
    const session: Session = { session_id: data.session_id, user }
    // Server sets HttpOnly ``sd_session_id``; avoid duplicating a JS-readable cookie.
    try {
      localStorage.setItem(SESSION_BACKUP_KEY, data.session_id)
    } catch {
      /* ignore */
    }
    setSession(session);
    setUser(user);

    if (!isAtelierExperience(user)) {
      void fetchHouseAgentKey(data.session_id).catch(() => {})
    }

    // Sync any local messages to backend after login
    syncLocalMessagesToBackend(data.session_id, user.email);
  };

  const signOut = async () => {
    const sessionId = session?.session_id ?? getCookie(SESSION_COOKIE)
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: sessionId ? { 'session-id': sessionId } : {},
      credentials: 'include',
    }).catch(() => {})
    try {
      localStorage.removeItem(SESSION_BACKUP_KEY)
    } catch {
      /* ignore */
    }
    deleteCookie(SESSION_COOKIE)
    clearHouseAgentKeyCache()
    setSession(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
