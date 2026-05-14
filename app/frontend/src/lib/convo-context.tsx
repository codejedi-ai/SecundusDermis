/**
 * convo-context.tsx
 *
 * Single source of truth for the AI chat conversation.
 *
 * - Logged-in users: messages are persisted to the backend (GET/POST/DELETE /conversations)
 *   and cached in localStorage as a fast-load fallback.
 * - Anonymous users: localStorage only.
 * - `chatSessionId` is the `session_id` for `POST /api/patron/agent/chat/stream` and Socket.IO
 *   `join_session` / `sd_<id>`. The user picks a default on the Agents page (persisted in
 *   `sd_stylist_session_id`); presets live in `stylist-session.ts`. Account transcripts
 *   still use the auth `session-id` header on `/conversations`, not this value.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth-context';
import * as chatApi from '../services/chatApi';
import * as fashionApi from '../services/fashionApi';
import {
  loadPersistedStylistSessionId,
  savePersistedStylistSessionId,
  sanitizeStylistSessionId,
} from './stylist-session';
import { getPatronAgentChatApiKey } from './patron-agent-chat-key';

/** Same as FastAPI `ChatRequest.session_id` default — used as initial preset. */
export const DEFAULT_STYLIST_SESSION_ID = 'default';

/** Dispatch on `window` to open the floating chat. */
export const SD_CHAT_OPEN_EVENT = 'sd:chat:open';

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
  /** Persisted chat `session_id` (chosen on /agents). */
  setStylistSessionId: (id: string) => void;
  addMessage: (msg: Omit<ConvoMessage, 'id' | 'timestamp'>) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ATTACHE_WELCOME =
  'Welcome to Secundus Dermis. I am your personal attaché.\n\n' +
  'Shall we begin with your preferred aesthetic, or would you like me to curate a selection from the archive? ' +
  'You may also present an image and I will identify pieces that harmonize with your vision.';

const PATRON_KEY_SETUP_NOTE =
  '\n\nTo send messages, save a patron `sdag_…` key: **AI agents** → **API keys** → **Save for in-browser chat.**';

/** First assistant message: attaché welcome, plus key setup only when this browser has no `sdag_…` yet. */
export function buildInitialConvoMessage(): ConvoMessage {
  const hasKey = Boolean(getPatronAgentChatApiKey()?.trim());
  return {
    id: 'init',
    role: 'assistant',
    content: hasKey ? ATTACHE_WELCOME : ATTACHE_WELCOME + PATRON_KEY_SETUP_NOTE,
    timestamp: 0,
  };
}

/** @deprecated Use ``buildInitialConvoMessage()`` — kept so saved threads that reference the id stay valid. */
export const INITIAL_MESSAGE: ConvoMessage = {
  id: 'init',
  role: 'assistant',
  content: ATTACHE_WELCOME,
  timestamp: 0,
};

// ── LocalStorage helpers ───────────────────────────────────────────────────

function lsMessagesKey(userEmail?: string) {
  return userEmail ? `sd_chat_messages_${userEmail}` : 'sd_chat_messages_anon';
}

/** Drop legacy assistant bubbles that only repeated the patron-key banner (now folded into ``init``). */
function stripLegacyPatronKeyDuplicates(msgs: ConvoMessage[]): ConvoMessage[] {
  return msgs.filter((m) => {
    if (m.role !== 'assistant') return true;
    const c = m.content.trim();
    if (c.startsWith('In-browser stylist requires a patron')) return false;
    return true;
  });
}

/** Load messages from localStorage. Strips blob URLs and products (not storable). */
function loadLocalMessages(userEmail?: string): ConvoMessage[] {
  try {
    const raw = localStorage.getItem(lsMessagesKey(userEmail));
    if (!raw) return [buildInitialConvoMessage()];
    const parsed: ConvoMessage[] = JSON.parse(raw);
    const safe = stripLegacyPatronKeyDuplicates(
      parsed.map((m) => ({ ...m, previewUrl: undefined, products: undefined })),
    );
    const initFresh = buildInitialConvoMessage();
    const normalized = safe.map((m) => (m.id === 'init' ? { ...m, content: initFresh.content } : m));
    return normalized.length > 0 ? normalized : [initFresh];
  } catch {
    return [buildInitialConvoMessage()];
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
  const [stylistSessionId, setStylistSessionIdState] = useState(loadPersistedStylistSessionId);

  const setStylistSessionId = useCallback((id: string) => {
    const s = sanitizeStylistSessionId(id);
    setStylistSessionIdState(s);
    savePersistedStylistSessionId(s);
  }, []);

  const chatSessionId = stylistSessionId;

  // When the authenticated user changes, reload their transcript (stylist session is unchanged).
  useEffect(() => {
    if (authSessionId) {
      // Logged in — load history from backend, fall back to localStorage cache.
      fashionApi
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
                fashionApi
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
      setMessages(loadLocalMessages(userEmail));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, authSessionId]);

  useEffect(() => {
    const syncInit = () => {
      setMessages((prev) => {
        const i = prev.findIndex((m) => m.id === 'init');
        if (i === -1) return prev;
        const latest = buildInitialConvoMessage();
        if (prev[i].content === latest.content) return prev;
        const next = [...prev];
        next[i] = { ...prev[i], content: latest.content };
        saveLocalMessages(next, userEmail);
        return next;
      });
    };
    window.addEventListener('sd:patron-chat-key-changed', syncInit);
    return () => window.removeEventListener('sd:patron-chat-key-changed', syncInit);
  }, [userEmail]);

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

    // Sync to backend only when authenticated
    if (authSessionId) {
      fashionApi
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
      console.log('[convo-context] Anonymous user, message saved to browser only');
    }
  };

  const value = useMemo(
    () => ({
      messages,
      chatSessionId,
      setStylistSessionId,
      addMessage,
    }),
    [messages, chatSessionId, setStylistSessionId, addMessage],
  );

  return <ConvoContext.Provider value={value}>{children}</ConvoContext.Provider>;
}

export function useConvo() {
  const ctx = useContext(ConvoContext);
  if (!ctx) throw new Error('useConvo must be used within a ConvoProvider');
  return ctx;
}
