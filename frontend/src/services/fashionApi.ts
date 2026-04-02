/**
 * fashionApi.ts
 * Typed client for the SecundusDermis FastAPI backend.
 *
 * Dev: default `/api` + `/images` via Vite proxy. If you set VITE_API_URL to a full URL,
 * see `lib/api-base.ts` — image URLs pick up the same host automatically.
 */

import { API_BASE } from '../lib/api-base';

export { API_BASE, productImageUrl } from '../lib/api-base';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Product {
  product_id: string;
  product_name: string;
  description: string;
  gender: string;
  category: string;
  price: number;
  similarity: number;
  image_url: string; // e.g. "/images/foo.jpg"
}


export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ShopFilter {
  gender?: string;
  category?: string;
  query?: string;
}

export interface ChatResponse {
  reply: string;
  products: Product[];
  intent: 'chitchat' | 'text_search' | 'image_search';
  filter?: ShopFilter;
}

export interface SearchResponse {
  results: Product[];
  query: string;
  total: number;
}

export interface CatalogStats {
  total_products: number;
  categories: string[];
  genders: string[];
  embedding_model: string;
  embedding_dim: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Get session ID from cookie (set by backend on login). */
function getSessionCookie(): string | null {
  const match = document.cookie.match(/(^| )sd_session_id=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Auto-inject session-id from cookie if not already provided
  const headersInit = init?.headers as Record<string, string> | undefined;
  const hasSessionId = headersInit?.['session-id'];
  
  // If no session-id header and we have a cookie, use it
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

// ── Endpoints ──────────────────────────────────────────────────────────────

/** Unified ADK agent: conversational recommendations with tool-calling. */
export async function* chatStream(
  message: string,
  imageId?: string,
  history: ChatMessage[] = [],
  sessionId?: string,
  authSessionId?: string,
): AsyncGenerator<{
  type: 'thinking_start' | 'thinking' | 'found_products' | 'final';
  content?: string;
  reply?: string;
  products?: Product[];
  intent?: string;
  filter?: ShopFilter;
  tools_used?: string[];
  count?: number;
}> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      image_id: imageId,
      history,
      session_id: sessionId ?? 'default',
      auth_session_id: authSessionId ?? null,
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

/** Direct text-search with optional filters. */
export function searchText(
  query: string,
  opts: { n_results?: number; gender?: string; category?: string; max_price?: number } = {},
): Promise<SearchResponse> {
  return request('/search/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, ...opts }),
  });
}

/** Upload an image for agent-based image search — returns image_id for use in chat. */
export function uploadImageForAgent(file: File): Promise<{ image_id: string; message: string }> {
  const form = new FormData();
  form.append('file', file);
  return request('/image/upload', { method: 'POST', body: form });
}

/** Paginated catalog browse — no embedding cost. */
export function browseCatalog(opts: {
  offset?: number;
  limit?: number;
  gender?: string;
  category?: string;
  q?: string;
} = {}): Promise<{ products: Product[]; offset: number; limit: number; total: number }> {
  const params = new URLSearchParams();
  if (opts.offset != null) params.set('offset', String(opts.offset));
  if (opts.limit   != null) params.set('limit',  String(opts.limit));
  if (opts.gender)          params.set('gender',  opts.gender);
  if (opts.category)        params.set('category', opts.category);
  if (opts.q)               params.set('q',        opts.q);
  return request(`/catalog/browse?${params}`);
}

/** Single product by ID — returns the product as stored in the catalog. */
export function getProduct(productId: string): Promise<Product> {
  return request(`/catalog/product/${productId}`);
}

/** Random products for homepage / discovery. */
export function getRandomProducts(
  n = 12,
): Promise<{ products: Product[] }> {
  return request(`/catalog/random?n=${n}`);
}

/** Catalog statistics (categories, genders, size). */
export function getCatalogStats(): Promise<CatalogStats> {
  return request('/catalog/stats');
}

// ── Cart ──────────────────────────────────────────────────────────────────

export interface CartItem {
  product_id: string;
  product_name: string;
  price: number;
  image_url: string;
  quantity: number;
}

export interface CartResponse {
  items: CartItem[];
  total: number;
}

export function getCart(sessionId: string): Promise<CartResponse> {
  return request('/cart', { headers: { 'session-id': sessionId } });
}

export function addToCart(
  sessionId: string,
  item: { product_id: string; product_name: string; price: number; image_url: string; quantity?: number },
): Promise<CartResponse> {
  const params = new URLSearchParams({
    product_id:   item.product_id,
    product_name: item.product_name,
    price:        String(item.price),
    image_url:    item.image_url,
    quantity:     String(item.quantity ?? 1),
  });
  return request(`/cart?${params}`, {
    method: 'POST',
    headers: { 'session-id': sessionId },
  });
}

export function updateCartItem(
  sessionId: string,
  productId: string,
  quantity: number,
): Promise<CartResponse> {
  return request(`/cart/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'session-id': sessionId },
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(sessionId: string, productId: string): Promise<CartResponse> {
  return request(`/cart/${productId}`, {
    method: 'DELETE',
    headers: { 'session-id': sessionId },
  });
}

// ── Patron activity ────────────────────────────────────────────────────────

export function recordActivity(
  sessionId: string,
  event: 'page_view' | 'product_view' | 'page_dwell' | 'search',
  path: string,
  label = '',
  seconds = 0,
): Promise<void> {
  return request('/patron/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'session-id': sessionId },
    body: JSON.stringify({ event, path, label, seconds }),
  }).then(() => undefined).catch(() => undefined); // best-effort, never throw
}

// ── Conversation history ───────────────────────────────────────────────────

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
    .catch((err) => {
      // Log auth errors, return empty for others
      if (err.message?.includes('401')) {
        console.log('[fashionApi] User not authenticated, skipping conversation fetch');
      } else {
        console.warn('[fashionApi] getConversation error:', err);
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
    .catch((err) => {
      // Log auth errors
      if (err.message?.includes('401')) {
        console.log('[fashionApi] User not authenticated, skipping conversation sync');
      } else {
        console.warn('[fashionApi] appendConversationMessage error:', err);
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
    .catch((err) => {
      // Log auth errors
      if (err.message?.includes('401')) {
        console.log('[fashionApi] User not authenticated, skipping conversation clear');
      } else {
        console.warn('[fashionApi] clearConversation error:', err);
      }
    });
}

/** Returns true if the backend is reachable. */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

