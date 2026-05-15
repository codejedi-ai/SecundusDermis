/**
 * Shop + Socket.IO types, and chat HTTP helpers.
 *
 * **Signed-in browser** — ``POST /api/browser/agent/chat/stream`` + image upload (``session-id`` / cookie).
 * **External integrations** — same chat body with ``Authorization: Bearer <sdag_…>`` on ``/api/patron/agent/*``.
 *
 * SSE carries stream tokens from the API. **Socket.IO** on the same ``session_id`` pushes stylist envelopes
 * (``sd_stylist_message``) so the chat panel updates replies and product cards **in real time** alongside the stream.
 */

import { API_BASE, productImageUrl } from '../lib/api-base';

export { API_BASE, productImageUrl };

// ── Types (shop + Socket.IO) ───────────────────────────────────────────────

export interface Product {
  product_id: string;
  product_name: string;
  description: string;
  gender: string;
  category: string;
  price: number;
  similarity?: number;
  image_url: string;
  body_area?: string;
}

export interface ShopFilter {
  gender?: string;
  category?: string;
  query?: string;
}

export interface ProductSection {
  id: string;
  label: string;
  description: string;
  products: Product[];
}

/**
 * UI actions the backend agent can send to control the frontend.
 */
export interface UiAction {
  action:
    | 'navigate'
    | 'apply_filter'
    | 'select_sidebar'
    | 'select_category'
    | 'set_search_hint'
    | 'highlight'
    | 'open_product'
    | 'scroll_to_shop'
    | 'clear_filters';
  payload?: Record<string, unknown>;
  description?: string;
}

export interface ShopContextPayload {
  gender?: string;
  category?: string;
  query?: string;
}

/** Canonical agent ↔ patron real-time envelope (see AGENT_MANIFEST.md). */
export interface StylistWsMessageV1 {
  schema: 'sd.stylist.v1';
  session_id: string;
  source: string;
  tool?: string | null;
  action: string;
  payload: Record<string, unknown>;
  meta: Record<string, unknown>;
}

export interface StylistWsCatalogSnapshot {
  products: Product[];
  mode: string;
}

export interface StylistWsFoundSnapshot {
  content: string;
  products: Product[];
  count: number;
}

export interface StylistWsReplySnapshot {
  reply: string;
  products: Product[];
  intent: string;
  filter: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatStreamEvent =
  | { type: 'thinking_start' | 'thinking'; content?: string; tool?: string }
  | { type: 'tool_call' | 'tool_result'; content?: string; tool?: string }
  | { type: 'found_products'; content?: string; products?: Product[]; count?: number }
  | {
      type: 'final';
      reply?: string;
      products?: Product[];
      sections?: ProductSection[];
      intent?: string;
      filter?: ShopFilter;
      tools_used?: string[];
    };

async function* parseChatSse(response: Response): AsyncGenerator<ChatStreamEvent> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data) as ChatStreamEvent;
          yield parsed;
        } catch {
          console.warn('Failed to parse stream event:', data);
        }
      }
    }
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/health`, { credentials: 'include' });
    return r.ok;
  } catch {
    return false;
  }
}

export async function uploadImage(
  file: File,
  patronAgentApiKey: string,
): Promise<{ image_id: string; message: string }> {
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(`${API_BASE}/patron/agent/image/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${patronAgentApiKey}` },
    body: form,
  });
  if (!r.ok) {
    const text = await r.text().catch(() => r.statusText);
    throw new Error(`${r.status} ${text}`);
  }
  return r.json() as Promise<{ image_id: string; message: string }>;
}

/** Image upload for the signed-in SPA (session cookie or ``session-id`` header). */
export async function uploadImageBrowserSession(
  file: File,
  browserSessionId: string,
): Promise<{ image_id: string; message: string }> {
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(`${API_BASE}/browser/agent/image/upload`, {
    method: 'POST',
    headers: { 'session-id': browserSessionId },
    body: form,
    credentials: 'include',
  });
  if (!r.ok) {
    const text = await r.text().catch(() => r.statusText);
    throw new Error(`${r.status} ${text}`);
  }
  return r.json() as Promise<{ image_id: string; message: string }>;
}

export async function* chatStream(
  message: string,
  imageId: string | undefined,
  sessionId: string,
  authSessionId: string | undefined,
  shopContext: ShopContextPayload | undefined,
  patronAgentApiKey: string,
  history: ChatMessage[] = [],
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch(`${API_BASE}/patron/agent/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patronAgentApiKey}`,
    },
    body: JSON.stringify({
      message,
      image_id: imageId ?? null,
      history,
      session_id: sessionId,
      auth_session_id: authSessionId ?? null,
      shop_context: shopContext ?? null,
    }),
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Stream failed: ${response.status} ${text}`);
  }

  yield* parseChatSse(response);
}

/** Stylist chat stream for the signed-in SPA (session cookie or ``session-id`` header). */
export async function* chatStreamBrowserSession(
  message: string,
  imageId: string | undefined,
  sessionId: string,
  authSessionId: string | undefined,
  shopContext: ShopContextPayload | undefined,
  browserSessionId: string,
  history: ChatMessage[] = [],
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch(`${API_BASE}/browser/agent/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'session-id': browserSessionId,
    },
    body: JSON.stringify({
      message,
      image_id: imageId ?? null,
      history,
      session_id: sessionId,
      auth_session_id: authSessionId ?? null,
      shop_context: shopContext ?? null,
    }),
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Stream failed: ${response.status} ${text}`);
  }

  yield* parseChatSse(response);
}
