/**
 * convo-context.tsx
 *
 * Single source of truth for the AI chat conversation.
 *
 * - Logged-in users: messages are persisted to the backend (GET/POST/DELETE /conversations)
 *   and cached in localStorage as a fast-load fallback.
 * - Anonymous users: localStorage only.
 * - `chatSessionId` is the ADK session ID sent to POST /chat. It is scoped per user
 *   so each account gets its own continuous agent memory.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import * as fashionApi from '../services/fashionApi';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConvoMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  products?: fashionApi.Product[];
  previewUrl?: string;   // blob URL for uploaded images — NOT persisted
  timestamp: number;
}

interface ConvoContextType {
  messages: ConvoMessage[];
  chatSessionId: string;
  addMessage: (msg: Omit<ConvoMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
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

// ── LocalStorage helpers ───────────────────────────────────────────────────

function lsSessionKey(userEmail?: string) {
  return userEmail ? `sd_chat_session_${userEmail}` : 'sd_chat_session_anon';
}

function lsMessagesKey(userEmail?: string) {
  return userEmail ? `sd_chat_messages_${userEmail}` : 'sd_chat_messages_anon';
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
  } catch { /* storage quota exceeded — ignore */ }
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

  // When the authenticated user changes, switch to their session + history.
  useEffect(() => {
    setChatSessionId(loadOrCreateChatSessionId(userEmail));

    if (authSessionId) {
      // Logged in — load history from backend, fall back to localStorage cache.
      fashionApi
        .getConversation(authSessionId)
        .then(stored => {
          if (stored.length === 0) {
            // No backend history yet; seed from localStorage cache if available.
            const local = loadLocalMessages(userEmail);
            setMessages(local);
            // Sync local cache up to backend.
            local
              .filter(m => m.id !== 'init')
              .forEach(m =>
                fashionApi
                  .appendConversationMessage(authSessionId, {
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                  })
                  .catch(() => {}),
              );
          } else {
            const hydrated: ConvoMessage[] = stored.map(s => ({
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
      setMessages(loadLocalMessages(userEmail));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, authSessionId]);

  // ── addMessage ─────────────────────────────────────────────────────────

  const addMessage = (msg: Omit<ConvoMessage, 'id' | 'timestamp'>) => {
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

    // Best-effort sync to backend (products and previewUrl are intentionally excluded).
    if (authSessionId) {
      fashionApi
        .appendConversationMessage(authSessionId, {
          role: full.role,
          content: full.content,
          timestamp: full.timestamp,
        })
        .catch(() => {});
    }
  };

  // ── clearMessages ──────────────────────────────────────────────────────

  const clearMessages = () => {
    setMessages([INITIAL_MESSAGE]);
    saveLocalMessages([INITIAL_MESSAGE], userEmail);
    if (authSessionId) {
      fashionApi.clearConversation(authSessionId).catch(() => {});
    }
  };

  return (
    <ConvoContext.Provider value={{ messages, chatSessionId, addMessage, clearMessages }}>
      {children}
    </ConvoContext.Provider>
  );
}

export function useConvo() {
  const ctx = useContext(ConvoContext);
  if (!ctx) throw new Error('useConvo must be used within a ConvoProvider');
  return ctx;
}
