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

const DEFAULT_DEV_BACKEND = 'http://localhost:8000';
const isBrowser = typeof window !== 'undefined';
const isLocalHostPage = isBrowser && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

function normalizeApiBase(): string {
  if (!VITE_API) return '/api';
  // If the build is configured for localhost but page is remote (e.g. ngrok),
  // force same-origin API so requests do not point to the viewer's localhost.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(VITE_API) && !isLocalHostPage) {
    return '/api';
  }
  return VITE_API;
}

/** Relative `/api` (proxied) or full URL to the API. */
export const API_BASE = normalizeApiBase();

function computeImageBase(): string {
  if (VITE_IMG) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(VITE_IMG) && !isLocalHostPage) {
      return '';
    }
    return VITE_IMG.replace(/\/$/, '');
  }
  if (VITE_BACKEND) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(VITE_BACKEND) && !isLocalHostPage) {
      return '';
    }
    return VITE_BACKEND.replace(/\/$/, '');
  }
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
