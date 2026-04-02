/**
 * Central API / asset bases for the browser.
 *
 * **API** — default `/api` (Vite + nginx proxy to FastAPI).
 *
 * **Images** (`/images/*`, `/uploads/*` from API) — should load from the FastAPI host.
 * - Set `VITE_BACKEND_URL` (e.g. `http://localhost:8000`) so `<img>` URLs hit the server directly.
 * - In dev, if unset, we default to `http://localhost:8000` while `API_BASE` stays `/api` (proxied).
 * - Production build: leave unset to use same-origin relative `/images` (nginx proxies to backend),
 *   or set `VITE_BACKEND_URL` at build time if the UI is served from a host without `/images` proxy.
 */

const VITE_API = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const VITE_IMG = (import.meta.env.VITE_IMAGE_URL as string | undefined)?.trim();
const VITE_BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();

/** Relative `/api` (proxied) or full URL to the API. */
export const API_BASE = VITE_API || '/api';

const DEFAULT_DEV_BACKEND = 'http://localhost:8000';

function computeImageBase(): string {
  if (VITE_IMG) return VITE_IMG.replace(/\/$/, '');
  if (VITE_BACKEND) return VITE_BACKEND.replace(/\/$/, '');
  if (VITE_API && /^https?:\/\//i.test(VITE_API)) {
    try {
      return new URL(VITE_API).origin;
    } catch {
      /* ignore */
    }
  }
  // Local Vite: talk to FastAPI directly for static mounts (matches uv run api.py).
  if (import.meta.env.DEV) {
    return DEFAULT_DEV_BACKEND.replace(/\/$/, '');
  }
  // Production: same-origin `/images` → nginx → backend
  return '';
}

/** Origin (no trailing slash) prepended to `/images/...` from the API. */
export const IMAGE_BASE = computeImageBase();

export function productImageUrl(image_url: string): string {
  if (!image_url) return '';
  if (/^https?:\/\//i.test(image_url)) return image_url;
  return `${IMAGE_BASE}${image_url}`;
}
