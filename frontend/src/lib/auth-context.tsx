/**
 * Auth context using backend API.
 * Session is stored in cookies for persistence across browser sessions.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────────────

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
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ── Cookie helpers ────────────────────────────────────────────────────────

const SESSION_COOKIE = 'sd_session_id';

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

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
    const sessionId = getCookie(SESSION_COOKIE);
    if (sessionId) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { 'session-id': sessionId },
        credentials: 'include',
      })
        .then(r => {
          if (!r.ok) { deleteCookie(SESSION_COOKIE); return null; }
          return r.json();
        })
        .then(u => {
          if (u) {
            const s: Session = { session_id: sessionId, user: u };
            setSession(s);
            setUser(u);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const signUp = async (email: string, password: string, name?: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(err.detail || 'Registration failed');
    }
  };

  const signIn = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Invalid credentials' }));
      throw new Error(err.detail || 'Invalid email or password');
    }
    const data: Session = await res.json();
    // Store session in both cookie and state for persistence
    setCookie(SESSION_COOKIE, data.session_id, 30); // 30 days
    setSession(data);
    setUser(data.user);
    
    // Sync any local messages to backend after login
    syncLocalMessagesToBackend(data.session_id, data.user.email);
  };

  const signOut = async () => {
    const sessionId = getCookie(SESSION_COOKIE);
    if (sessionId) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'session-id': sessionId },
        credentials: 'include',
      }).catch(() => {});
    }
    deleteCookie(SESSION_COOKIE);
    setSession(null);
    setUser(null);
  };

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
