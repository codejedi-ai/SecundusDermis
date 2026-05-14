/**
 * Central API / asset bases for the browser.
 *
 * **Origin vs path** — Between environments, only the **origin** (scheme + host + port; in local
 * dev often “the IP”) changes. Paths such as ``/api/...`` stay fixed; the SPA uses relative ``/api``.
 *
 * **Dev vs prod**
 * - **Vite dev server** (`npm run dev`): ``API_BASE`` is always ``PUBLIC_HTTP_API_PREFIX`` (``VITE_API_URL``
 *   ignored for JSON). Vite forwards ``/api/...`` unchanged to FastAPI — same paths as ``run.sh prod`` / nginx + backend.
 * - **Production**: the built SPA is served **by the backend** (``app/dist`` on FastAPI, or nginx
 *   in front of the same origin). Leave ``VITE_API_URL`` unset so ``API_BASE`` stays ``/api`` on
 *   that host. Only set ``VITE_API_URL`` to a full URL when the HTML is on a *different* origin
 *   than the API (unusual for this project).
 *
 * **``VITE_API_URL``** — optional Vite env (baked in at ``npm run build``). If set, it becomes the
 *   base string for REST calls (e.g. ``https://api.example.com`` or ``http://localhost:8000``).
 *   If unset/empty, ``API_BASE`` is ``/api`` (relative to whatever page is serving the SPA).
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

/** Same path prefix as ``PUBLIC_HTTP_API_PREFIX`` in ``app/backend/config.py`` (``APIRouter`` prefix). */
export const PUBLIC_HTTP_API_PREFIX = '/api' as const;

function normalizeApiBase(): string {
  // Vite dev server: always same-origin `/api` so requests hit the proxy (FastAPI can use CORS_ENABLED=false).
  // A local `VITE_API_URL=http://localhost:8000` would otherwise bypass the proxy and fail with NetworkError.
  if (import.meta.env.DEV) {
    return PUBLIC_HTTP_API_PREFIX;
  }
  if (!VITE_API) return PUBLIC_HTTP_API_PREFIX;
  // If the build is configured for localhost but page is remote (e.g. ngrok),
  // force same-origin API so requests do not point to the viewer's localhost.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(VITE_API) && !isLocalHostPage) {
    return PUBLIC_HTTP_API_PREFIX;
  }
  return VITE_API;
}

/** Relative `/api` (proxied in dev) or full URL to the API (production split-origin only). */
export const API_BASE = normalizeApiBase();

/**
 * Origin for ``socket.io-client`` (path stays ``/socket.io``).
 * When ``API_BASE`` is relative, use the page origin so dev traffic goes through the Vite WebSocket proxy.
 */
export function socketIoOrigin(): string {
  if (!isBrowser) {
    return '';
  }
  if (API_BASE.startsWith('/')) {
    return window.location.origin;
  }
  try {
    return new URL(API_BASE).origin;
  } catch {
    return window.location.origin;
  }
}

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
