/**
 * Local auth — no external service.
 * Accounts are stored in localStorage under "sd_users".
 * The active session is stored under "sd_session".
 */
import React, { createContext, useContext, useEffect, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Session {
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

// ── Storage helpers ────────────────────────────────────────────────────────

const USERS_KEY = 'sd_users';
const SESSION_KEY = 'sd_session';

interface StoredUser extends User {
  pw: string; // base64-encoded password
}

function loadUsers(): StoredUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]'); }
  catch { return []; }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null'); }
  catch { return null; }
}

function persistSession(session: Session | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const s = loadSession();
    if (s) { setSession(s); setUser(s.user); }
    setIsLoading(false);
  }, []);

  const signUp = async (email: string, password: string) => {
    const users = loadUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists');
    }
    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      email,
      created_at: new Date().toISOString(),
      pw: btoa(password),
    };
    saveUsers([...users, newUser]);
  };

  const signIn = async (email: string, password: string) => {
    const found = loadUsers().find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.pw === btoa(password),
    );
    if (!found) throw new Error('Invalid email or password');
    const { pw: _pw, ...publicUser } = found;
    const s: Session = { user: publicUser };
    persistSession(s);
    setSession(s);
    setUser(publicUser);
  };

  const signOut = async () => {
    persistSession(null);
    setSession(null);
    setUser(null);
  };

  // No server → password reset is not supported
  const resetPassword = async (_email: string) => {
    throw new Error('Password reset is not available in offline mode');
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
