/**
 * convo-context.tsx
 *
 * Single source of truth for the AI chat conversation.
 *
 * - Logged-in users: messages are persisted to the backend (GET/POST/DELETE /conversations)
 *   and cached in localStorage as a fast-load fallback.
 * - Anonymous users (Guest mode): localStorage only, limited to 10 messages.
 * - `chatSessionId` is the ADK session ID sent to POST /chat. It is scoped per user
 *   so each account gets its own continuous agent memory.
 *
 * Guest Mode:
 * - Messages stored in localStorage for 2 days
 * - After 10 messages, user is prompted to sign in to continue
 * - On sign-in, all guest messages are migrated to backend
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import * as chatApi from '../services/chatApi';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConvoMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  products?: chatApi.Product[];
  sections?: chatApi.ProductSection[];
  previewUrl?: string;   // blob URL for uploaded images — NOT persisted
  timestamp: number;
}

interface ConvoContextType {
  messages: ConvoMessage[];
  chatSessionId: string;
  addMessage: (msg: Omit<ConvoMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  isGuest: boolean;
  guestMessageCount: number;
  isGuestLimitReached: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

export const INITIAL_MESSAGE: ConvoMessage = {
  id: 'init',
  role: 'assistant',
  content:
    "Welcome to Secundus Dermis. I am your personal attaché.\n\n" +
    "Shall we begin with your preferred aesthetic, or would you like me to curate a selection from the archive? " +
    "You may also present an image and I will identify pieces that harmonize with your vision.",
  timestamp: 0,
};

export const GUEST_MESSAGE_LIMIT = 10;
const GUEST_STORAGE_EXPIRY_DAYS = 2;

// ── LocalStorage helpers ───────────────────────────────────────────────────

function lsSessionKey(userEmail?: string) {
  return userEmail ? `sd_chat_session_${userEmail}` : 'sd_chat_session_anon';
}

function lsMessagesKey(userEmail?: string) {
  return userEmail ? `sd_chat_messages_${userEmail}` : 'sd_chat_messages_anon';
}

function lsGuestExpiryKey() {
  return 'sd_chat_guest_expiry';
}

function loadOrCreateChatSessionId(userEmail?: string): string {
  const key = lsSessionKey(userEmail);
  try {
    const stored = localStorage.getItem(key);
    if (stored) return stored;
  } catch { /* ignore */ }
  const id = crypto.randomUUID();
  try { localStorage.setItem(key, id); } catch { /* ignore */ }
  return id;
}

/** Load messages from localStorage. Strips blob URLs and products (not storable). */
function loadLocalMessages(userEmail?: string): ConvoMessage[] {
  try {
    const raw = localStorage.getItem(lsMessagesKey(userEmail));
    if (!raw) return [INITIAL_MESSAGE];
    const parsed: ConvoMessage[] = JSON.parse(raw);
    const safe = parsed.map(m => ({ ...m, previewUrl: undefined, products: undefined }));
    return safe.length > 0 ? safe : [INITIAL_MESSAGE];
  } catch {
    return [INITIAL_MESSAGE];
  }
}

function saveLocalMessages(msgs: ConvoMessage[], userEmail?: string) {
  try {
    const safe = msgs.map(m => ({ ...m, previewUrl: undefined, products: undefined }));
    localStorage.setItem(lsMessagesKey(userEmail), JSON.stringify(safe));
    // Set expiry for guest data
    if (!userEmail) {
      const expiry = Date.now() + (GUEST_STORAGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      localStorage.setItem(lsGuestExpiryKey(), expiry.toString());
    }
  } catch { /* storage quota exceeded — ignore */ }
}

function isGuestDataExpired(): boolean {
  try {
    const expiry = localStorage.getItem(lsGuestExpiryKey());
    if (!expiry) return false;
    return Date.now() > parseInt(expiry, 10);
  } catch {
    return false;
  }
}

function clearGuestData() {
  try {
    localStorage.removeItem(lsMessagesKey(undefined));
    localStorage.removeItem(lsSessionKey(undefined));
    localStorage.removeItem(lsGuestExpiryKey());
  } catch { /* ignore */ }
}

// ── Context ────────────────────────────────────────────────────────────────

const ConvoContext = createContext<ConvoContextType | undefined>(undefined);

export function ConvoProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const userEmail = user?.email;
  const authSessionId = session?.session_id;

  const [messages, setMessages] = useState<ConvoMessage[]>(() =>
    loadLocalMessages(userEmail),
  );
  const [chatSessionId, setChatSessionId] = useState(() =>
    loadOrCreateChatSessionId(userEmail),
  );

  // Guest mode state
  const isGuest = !userEmail;
  const guestMessageCount = isGuest ? Math.max(0, messages.length - 1) : 0; // Exclude initial message
  const isGuestLimitReached = isGuest && guestMessageCount >= GUEST_MESSAGE_LIMIT;

  // Check for expired guest data on mount
  useEffect(() => {
    if (isGuest && isGuestDataExpired()) {
      console.log('[convo-context] Guest data expired, clearing...');
      clearGuestData();
      setMessages([INITIAL_MESSAGE]);
    }
  }, [isGuest]);

  // When the authenticated user changes, switch to their session + history.
  useEffect(() => {
    setChatSessionId(loadOrCreateChatSessionId(userEmail));

    if (authSessionId) {
      // Logged in — load history from backend, fall back to localStorage cache.
      chatApi
        .getConversation(authSessionId)
        .then((stored: any[]) => {
          if (stored.length === 0) {
            // No backend history yet; seed from localStorage cache if available.
            const local = loadLocalMessages(userEmail);
            setMessages(local);
            // Sync local cache up to backend.
            local
              .filter(m => m.id !== 'init')
              .forEach(m =>
                chatApi
                  .appendConversationMessage(authSessionId, {
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                  })
                  .catch(() => {}),
              );
          } else {
            const hydrated: ConvoMessage[] = stored.map((s: any) => ({
              id: crypto.randomUUID(),
              role: s.role as 'user' | 'assistant',
              content: s.content,
              timestamp: s.timestamp,
            }));
            setMessages(hydrated);
            saveLocalMessages(hydrated, userEmail);
          }
        })
        .catch(() => {
          // Network error — use localStorage cache.
          setMessages(loadLocalMessages(userEmail));
        });
    } else {
      // Anonymous — localStorage only.
      setMessages(loadLocalMessages(undefined));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, authSessionId]);

  // ── addMessage ─────────────────────────────────────────────────────────

  const addMessage = (msg: Omit<ConvoMessage, 'id' | 'timestamp'>) => {
    // Block guest users if limit reached
    if (isGuest && isGuestLimitReached) {
      console.warn('[convo-context] Guest limit reached, message not added');
      return;
    }

    const full: ConvoMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    setMessages(prev => {
      const next = [...prev, full];
      saveLocalMessages(next, userEmail);
      return next;
    });

    // Sync to backend only when authenticated
    if (authSessionId) {
      chatApi
        .appendConversationMessage(authSessionId, {
          role: full.role,
          content: full.content,
          timestamp: full.timestamp,
        })
        .catch((err: any) => {
          if (err?.message?.includes('401')) {
            console.log('[convo-context] User not authenticated, message saved to browser only');
          } else {
            console.warn('[convo-context] Failed to sync message to backend:', err);
          }
        });
    } else {
      console.log(`[convo-context] Guest user, message ${guestMessageCount + 1}/${GUEST_MESSAGE_LIMIT} saved to browser`);
    }
  };

  const clearMessages = () => {
    setMessages([INITIAL_MESSAGE]);
    if (userEmail) {
      saveLocalMessages([INITIAL_MESSAGE], userEmail);
    } else {
      clearGuestData();
    }
  };

  return (
    <ConvoContext.Provider value={{ messages, chatSessionId, addMessage, clearMessages, isGuest, guestMessageCount, isGuestLimitReached }}>
      {children}
    </ConvoContext.Provider>
  );
}

export function useConvo() {
  const ctx = useContext(ConvoContext);
  if (!ctx) throw new Error('useConvo must be used within a ConvoProvider');
  return ctx;
}
