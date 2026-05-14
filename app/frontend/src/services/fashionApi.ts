/**
 * fashionApi.ts
 * Typed client for the SecundusDermis FastAPI backend.
 *
 * Dev: ``API_BASE`` is ``/api`` (Vite proxy). Images use ``VITE_BACKEND_URL`` / ``VITE_IMAGE_URL`` or
 * ``http://localhost:8000`` in dev (see ``lib/api-base.ts``). In ``npm run dev``, ``VITE_API_URL`` does not change ``API_BASE``.
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
  /** Same label as GET /api/health ``search_mode`` (server retrieval stack). */
  search_mode?: string;
  /** True when ``AGENT_SERVICE_URL`` is set (chat proxied to standalone agent). */
  agent_proxy?: boolean;
  /** Trusted Socket.IO clients in ``sd_agent_service`` (duplex agent channel). */
  agent_socket_online_count?: number;
  /** Whether ``GET {AGENT_SERVICE_URL}/health`` succeeded (null when agent HTTP client not configured). */
  stylist_agent_http_reachable?: boolean | null;
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

export interface PatronShopSelectionDTO {
  gender?: string;
  category?: string;
  query?: string;
  input_value?: string;
  sidebar_width?: number;
}

/** Saved shop filters for the logged-in patron (cross-page + return visits). */
export function getPatronShopSelection(sessionId: string): Promise<PatronShopSelectionDTO> {
  if (!sessionId) return Promise.resolve({});
  return request<PatronShopSelectionDTO>('/patron/shop-selection', {
    headers: { 'session-id': sessionId },
  }).catch(() => ({}));
}

export function putPatronShopSelection(
  sessionId: string,
  body: PatronShopSelectionDTO,
): Promise<PatronShopSelectionDTO> {
  if (!sessionId) return Promise.resolve({});
  return request<PatronShopSelectionDTO>('/patron/shop-selection', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'session-id': sessionId },
    body: JSON.stringify(body),
  }).catch(() => ({}));
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

// ── Patron agent API keys (external tools / agents) ─────────────────────────

export interface AgentApiKeyMeta {
  id: string;
  prefix: string;
  label: string;
  created_at: number;
  last_used_at: number | null;
}

export interface AgentApiKeyCreated extends AgentApiKeyMeta {
  token: string;
}

/** Mint/list/revoke keys require browser session (``session-id`` header); external tools use the returned key on ``/patron/agent/*``. */
export function listAgentApiKeys(sessionId: string): Promise<{ keys: AgentApiKeyMeta[] }> {
  return request('/auth/agent-api-keys', {
    headers: { 'session-id': sessionId },
  });
}

export function createAgentApiKey(label: string, sessionId: string): Promise<AgentApiKeyCreated> {
  return request('/auth/agent-api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'session-id': sessionId },
    body: JSON.stringify({ label }),
  });
}

export function revokeAgentApiKey(keyId: string, sessionId: string): Promise<{ status: string; id: string }> {
  return request(`/auth/agent-api-keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
    headers: { 'session-id': sessionId },
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

