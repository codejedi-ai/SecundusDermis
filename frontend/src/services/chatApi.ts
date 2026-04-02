/**
 * chatApi.ts
 * Chat API for AI Fashion Agent - Direct Gemini SDK connection
 * Connects frontend to backend chat endpoints with streaming support
 */

import { API_BASE, IMAGE_BASE } from '../lib/api-base';
export { API_BASE, IMAGE_BASE };

// ── Types ──────────────────────────────────────────────────────────────────

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

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  products?: Product[];
  previewUrl?: string;
}

export interface ChatResponse {
  reply: string;
  products: Product[];
  intent: 'chitchat' | 'text_search' | 'image_search';
  filter?: ShopFilter;
}

export interface ProductSection {
  id: string;
  label: string;
  description: string;
  products: Product[];
}

/**
 * UI actions the backend agent can send to control the frontend.
 *
 * action types:
 *   navigate        — go to a route (payload: { path: string })
 *   apply_filter    — set shop gender/category via sidebar (payload: { gender?, category? })
 *   select_sidebar  — alias for apply_filter, semantically: agent picks sidebar pills
 *   select_category — same as apply_filter (backend agent emit)
 *   set_search_hint — agent writes a directional hint into the search bar to show where it's heading (payload: { query: string })
 *   highlight       — highlight a product card (payload: { product_id: string })
 *   open_product    — navigate to a product page (payload: { product_id: string })
 *   scroll_to_shop  — navigate to the shop page (no payload)
 *   clear_filters   — reset sidebar gender/category (no payload)
 */
export interface UiAction {
  action: 'navigate' | 'apply_filter' | 'select_sidebar' | 'select_category' | 'set_search_hint' | 'highlight' | 'open_product' | 'scroll_to_shop' | 'clear_filters';
  payload?: Record<string, unknown>;
  description?: string;
}

export interface StreamEvent {
  type: 'thinking_start' | 'thinking' | 'found_products' | 'tool_call' | 'tool_result' | 'ui_action' | 'final' | 'error';
  content?: string;
  tool?: string;
  reply?: string;
  products?: Product[];
  sections?: ProductSection[];
  intent?: string;
  filter?: ShopFilter;
  count?: number;
  ui_action?: UiAction;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Get session ID from cookie (set by backend on login). */
function getSessionCookie(): string | null {
  const match = document.cookie.match(/(^| )sd_session_id=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headersInit = init?.headers as Record<string, string> | undefined;
  const hasSessionId = headersInit?.['session-id'];
  
  // Auto-inject session-id from cookie if not already provided
  if (!hasSessionId) {
    const cookieSession = getSessionCookie();
    if (cookieSession) {
      const newHeaders = { ...(headersInit || {}), 'session-id': cookieSession };
      return fetch(`${API_BASE}${path}`, {
        ...init,
        headers: newHeaders,
        credentials: 'include',
      }).then(async res => {
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText);
          throw new Error(`${res.status} ${text}`);
        }
        return res.json() as Promise<T>;
      });
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: headersInit,
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Chat Endpoints ─────────────────────────────────────────────────────────

/**
 * Send a chat message to the AI agent and get a response.
 * The agent will search the catalog and return products with filters.
 */
export async function chat(
  message: string,
  sessionId?: string,
  authSessionId?: string,
): Promise<ChatResponse> {
  return request('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      session_id: sessionId ?? 'default',
      auth_session_id: authSessionId ?? null,
    }),
  });
}

/**
 * Send a chat message with an uploaded image to the AI agent.
 * The agent will analyze the image and find similar products.
 */
export async function chatWithImage(
  message: string,
  imageId: string,
  sessionId?: string,
  authSessionId?: string,
): Promise<ChatResponse> {
  return request('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      image_id: imageId,
      session_id: sessionId ?? 'default',
      auth_session_id: authSessionId ?? null,
    }),
  });
}

/**
 * Stream chat response with real-time thinking process.
 * Yields events as the agent thinks and searches.
 */
export interface ShopContextPayload {
  gender?: string;
  category?: string;
  query?: string;
}

export async function* chatStream(
  message: string,
  imageId?: string,
  sessionId?: string,
  authSessionId?: string,
  shopContext?: ShopContextPayload,
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      image_id: imageId,
      session_id: sessionId ?? 'default',
      auth_session_id: authSessionId ?? null,
      shop_context: shopContext ?? null,
    }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Stream failed: ${response.status}`);
  }

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
          const parsed = JSON.parse(data);
          yield parsed;
        } catch (e) {
          console.warn('Failed to parse stream event:', data);
        }
      }
    }
  }
}

/**
 * Upload an image for the AI agent to analyze.
 * Returns an image_id that can be used in chatWithImage or chatStream.
 */
export async function uploadImage(file: File): Promise<{ image_id: string; message: string }> {
  const form = new FormData();
  form.append('file', file);
  return request('/image/upload', { method: 'POST', body: form });
}

// ── Utility Functions ──────────────────────────────────────────────────────

/** Build the full URL for a product image returned by the API. */
export function productImageUrl(image_url: string): string {
  return `${IMAGE_BASE}${image_url}`;
}

/** Check if the backend is reachable. */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Conversation History ───────────────────────────────────────────────────

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/** Fetch all stored messages for the current session (requires auth). */
export function getConversation(sessionId: string): Promise<StoredMessage[]> {
  return request<{ messages: StoredMessage[] }>('/conversations', {
    headers: { 'session-id': sessionId },
  })
    .then(r => r.messages ?? [])
    .catch((err: any) => {
      if (err.message?.includes('401')) {
        console.log('[chatApi] User not authenticated, skipping conversation fetch');
      } else {
        console.warn('[chatApi] getConversation error:', err);
      }
      return [];
    });
}

/** Append one message to the server-side history (requires auth). */
export function appendConversationMessage(
  sessionId: string,
  msg: StoredMessage,
): Promise<void> {
  return request('/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'session-id': sessionId },
    body: JSON.stringify(msg),
  })
    .then(() => undefined)
    .catch((err: any) => {
      if (err.message?.includes('401')) {
        console.log('[chatApi] User not authenticated, skipping conversation sync');
      } else {
        console.warn('[chatApi] appendConversationMessage error:', err);
      }
    });
}

/** Clear the entire conversation history for this session (requires auth). */
export function clearConversation(sessionId: string): Promise<void> {
  return request('/conversations', {
    method: 'DELETE',
    headers: { 'session-id': sessionId },
  })
    .then(() => undefined)
    .catch((err: any) => {
      if (err.message?.includes('401')) {
        console.log('[chatApi] User not authenticated, skipping conversation clear');
      } else {
        console.warn('[chatApi] clearConversation error:', err);
      }
    });
}
