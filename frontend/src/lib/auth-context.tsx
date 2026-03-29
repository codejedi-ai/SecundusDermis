/**
 * Auth context using backend API.
 * Session is stored in localStorage as session_id.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7860';

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

// ── Storage helpers ────────────────────────────────────────────────────────

const SESSION_KEY = 'sd_session_id';

function loadSessionId(): string | null {
  try { return localStorage.getItem(SESSION_KEY); }
  catch { return null; }
}

function persistSessionId(sessionId: string | null) {
  if (sessionId) localStorage.setItem(SESSION_KEY, sessionId);
  else localStorage.removeItem(SESSION_KEY);
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sessionId = loadSessionId();
    if (sessionId) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { 'session_id': sessionId }
      })
        .then(r => r.ok ? r.json() : null)
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
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Invalid credentials' }));
      throw new Error(err.detail || 'Invalid email or password');
    }
    const data: Session = await res.json();
    persistSessionId(data.session_id);
    setSession(data);
    setUser(data.user);
  };

  const signOut = async () => {
    const sessionId = loadSessionId();
    if (sessionId) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'session-id': sessionId }
      }).catch(() => {});
    }
    persistSessionId(null);
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
