import { API_BASE } from './fashionApi';

// ── Helpers ────────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Endpoints ──────────────────────────────────────────────────────────────

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

export function createJournalPost(post: NewJournalPost, sessionId: string): Promise<{ slug: string; message: string }> {
  return request('/journal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'session-id': sessionId },
    body: JSON.stringify(post),
  });
}
