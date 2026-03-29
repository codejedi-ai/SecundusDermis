/**
 * fashionApi.ts
 * Typed client for the SecundusDermis FastAPI backend.
 *
 * Dev (Vite proxy):   all calls go to /api/* → localhost:8000/*
 * Prod:               set VITE_API_URL=https://your-backend.com
 *                     set VITE_IMAGE_URL=https://your-backend.com  (for /images/* assets)
 */

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
export const IMAGE_BASE = (import.meta.env.VITE_IMAGE_URL as string | undefined) ?? '';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Endpoints ──────────────────────────────────────────────────────────────

/** Unified ADK agent: conversational recommendations with tool-calling. */
export function chat(
  message: string,
  history: ChatMessage[] = [],
  sessionId?: string,
  authSessionId?: string,
): Promise<ChatResponse> {
  return request('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      session_id: sessionId ?? 'default',
      auth_session_id: authSessionId ?? null,
    }),
  });
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

/** Image-based search — upload a File to find visually similar products. */
export function searchImage(
  file: File,
  opts: { n_results?: number; gender?: string; category?: string } = {},
): Promise<SearchResponse> {
  const form = new FormData();
  form.append('file', file);
  if (opts.n_results != null) form.append('n_results', String(opts.n_results));
  if (opts.gender) form.append('gender', opts.gender);
  if (opts.category) form.append('category', opts.category);
  return request('/search/image', { method: 'POST', body: form });
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

// ── Journal ────────────────────────────────────────────────────────────────

export interface JournalPost {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  category: string;
  tags: string[];
  featured: boolean;
  image: string;
  read_time: string;
  body?: string; // only present on single-post fetch
}

export function getJournalList(opts: { category?: string; featured?: boolean } = {}): Promise<{ posts: JournalPost[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.category) params.set('category', opts.category);
  if (opts.featured != null) params.set('featured', String(opts.featured));
  return request(`/journal?${params}`);
}

export function getJournalPost(slug: string): Promise<JournalPost> {
  return request(`/journal/${slug}`);
}

export function getJournalCategories(): Promise<{ categories: string[] }> {
  return request('/journal/categories');
}

export interface NewJournalPost {
  title: string;
  excerpt: string;
  author: string;
  date: string;
  read_time: string;
  category: string;
  tags: string[];
  featured: boolean;
  image: string;
  body: string;
}

export function createJournalPost(post: NewJournalPost, adminKey: string): Promise<{ slug: string; message: string }> {
  return request('/journal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
    body: JSON.stringify(post),
  });
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
  return request('/cart', { headers: { session_id: sessionId } });
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
    headers: { session_id: sessionId },
  });
}

export function updateCartItem(
  sessionId: string,
  productId: string,
  quantity: number,
): Promise<CartResponse> {
  return request(`/cart/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', session_id: sessionId },
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(sessionId: string, productId: string): Promise<CartResponse> {
  return request(`/cart/${productId}`, {
    method: 'DELETE',
    headers: { session_id: sessionId },
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
    headers: { 'Content-Type': 'application/json', session_id: sessionId },
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
    headers: { session_id: sessionId },
  }).then(r => r.messages ?? []);
}

/** Append one message to the server-side history (requires auth). */
export function appendConversationMessage(
  sessionId: string,
  msg: StoredMessage,
): Promise<void> {
  return request('/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', session_id: sessionId },
    body: JSON.stringify(msg),
  }).then(() => undefined);
}

/** Clear the entire conversation history for this session (requires auth). */
export function clearConversation(sessionId: string): Promise<void> {
  return request('/conversations', {
    method: 'DELETE',
    headers: { session_id: sessionId },
  }).then(() => undefined);
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

/** Build the full URL for a product image returned by the API. */
export function productImageUrl(image_url: string): string {
  return `${IMAGE_BASE}${image_url}`;
}
