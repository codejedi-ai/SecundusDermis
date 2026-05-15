/**
 * Central API / asset bases for the browser.
 *
 * **Contract:** Patron JSON routes always live under ``/api/...`` (see ``PUBLIC_HTTP_API_PREFIX``).
 *
 * - **Dev** (`npm run dev` / ``./run.sh dev``): ``API_BASE`` is ``/api`` → Vite proxies to FastAPI.
 * - **Prod** (``./run.sh prod``): built SPA served on :8000; ``API_BASE`` is ``/api`` on that origin.
 * - **Split-origin prod:** set ``VITE_API_URL`` to the API host at build time (``withPublicApiPrefix`` adds ``/api`` if missing).
 */

const VITE_API = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const VITE_IMG = (import.meta.env.VITE_IMAGE_URL as string | undefined)?.trim();
const VITE_BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();

const DEFAULT_DEV_BACKEND = 'http://localhost:8000';
const isBrowser = typeof window !== 'undefined';

/** Same path prefix as ``PUBLIC_HTTP_API_PREFIX`` in ``app/backend/config.py``. */
export const PUBLIC_HTTP_API_PREFIX = '/api' as const;

const LOCALHOST_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function isLocalhostUrl(url: string): boolean {
  return LOCALHOST_ORIGIN_RE.test(url.trim().replace(/\/$/, ''));
}

function pageOriginHostname(pageOrigin: string): string {
  try {
    return new URL(pageOrigin).hostname;
  } catch {
    return '';
  }
}

/**
 * FastAPI patron routes are mounted at ``/api/...``. A bare origin in ``VITE_API_URL``
 * (e.g. ``http://localhost:8000``) must not produce ``/auth/me``.
 */
export function withPublicApiPrefix(apiBase: string): string {
  const trimmed = apiBase.trim().replace(/\/$/, '');
  if (!trimmed) return PUBLIC_HTTP_API_PREFIX;
  if (trimmed.startsWith('/')) {
    return trimmed === PUBLIC_HTTP_API_PREFIX || trimmed.startsWith(`${PUBLIC_HTTP_API_PREFIX}/`)
      ? trimmed
      : PUBLIC_HTTP_API_PREFIX;
  }
  try {
    const url = new URL(trimmed);
    const path = url.pathname.replace(/\/$/, '') || '';
    if (path === '' || path === '/') {
      return `${url.origin}${PUBLIC_HTTP_API_PREFIX}`;
    }
    if (path === PUBLIC_HTTP_API_PREFIX || path.startsWith(`${PUBLIC_HTTP_API_PREFIX}/`)) {
      return `${url.origin}${path}`;
    }
    return `${url.origin}${PUBLIC_HTTP_API_PREFIX}`;
  } catch {
    return PUBLIC_HTTP_API_PREFIX;
  }
}

export type ResolveApiBaseInput = {
  /** Vite dev server — always use proxied ``/api``. */
  dev: boolean;
  /** ``import.meta.env.VITE_API_URL`` at build time (may be empty). */
  viteApiUrl?: string;
  /** ``window.location.origin`` when resolving in the browser. */
  pageOrigin?: string;
};

/** Pure resolver used by ``API_BASE`` and unit tests (dev + prod matrix). */
export function resolveApiBase(input: ResolveApiBaseInput): string {
  const viteApi = (input.viteApiUrl ?? '').trim();
  if (input.dev) {
    return PUBLIC_HTTP_API_PREFIX;
  }
  if (!viteApi) {
    return PUBLIC_HTTP_API_PREFIX;
  }

  const pageHost = input.pageOrigin ? pageOriginHostname(input.pageOrigin) : '';
  const pageIsLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(pageHost);

  // ngrok / remote viewer: do not call the viewer's baked-in localhost API.
  if (isLocalhostUrl(viteApi) && input.pageOrigin && !pageIsLocalhost) {
    return PUBLIC_HTTP_API_PREFIX;
  }

  // run.sh prod on :8000 (or any same-origin deploy).
  if (input.pageOrigin) {
    try {
      const configured = new URL(viteApi, input.pageOrigin);
      if (configured.origin === new URL(input.pageOrigin).origin) {
        return PUBLIC_HTTP_API_PREFIX;
      }
    } catch {
      /* ignore */
    }
  }

  return withPublicApiPrefix(viteApi);
}

function normalizeApiBase(): string {
  return resolveApiBase({
    dev: import.meta.env.DEV,
    viteApiUrl: VITE_API,
    pageOrigin: isBrowser ? window.location.origin : undefined,
  });
}

/** Relative ``/api`` (dev proxy + same-origin prod) or full API URL (split-origin prod). */
export const API_BASE = normalizeApiBase();

/** Origin for ``socket.io-client`` (path stays ``/socket.io``). */
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

export type ResolveImageBaseInput = {
  dev: boolean;
  viteApiUrl?: string;
  viteImageUrl?: string;
  viteBackendUrl?: string;
  pageOrigin?: string;
};

export function resolveImageBase(input: ResolveImageBaseInput): string {
  const viteImg = (input.viteImageUrl ?? '').trim();
  const viteBackend = (input.viteBackendUrl ?? '').trim();
  const viteApi = (input.viteApiUrl ?? '').trim();
  const pageHost = input.pageOrigin ? pageOriginHostname(input.pageOrigin) : '';
  const pageIsLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(pageHost);

  const localhostGuard = (url: string) =>
    isLocalhostUrl(url) && input.pageOrigin && !pageIsLocalhost;

  if (viteImg) {
    if (localhostGuard(viteImg)) return '';
    return viteImg.replace(/\/$/, '');
  }
  if (viteBackend) {
    if (localhostGuard(viteBackend)) return '';
    return viteBackend.replace(/\/$/, '');
  }
  if (viteApi && /^https?:\/\//i.test(viteApi)) {
    if (localhostGuard(viteApi)) return '';
    if (input.pageOrigin) {
      try {
        if (new URL(viteApi, input.pageOrigin).origin === new URL(input.pageOrigin).origin) {
          return '';
        }
      } catch {
        /* ignore */
      }
    }
    try {
      return new URL(viteApi).origin;
    } catch {
      /* ignore */
    }
  }
  if (input.dev) {
    return DEFAULT_DEV_BACKEND.replace(/\/$/, '');
  }
  return '';
}

function computeImageBase(): string {
  return resolveImageBase({
    dev: import.meta.env.DEV,
    viteApiUrl: VITE_API,
    viteImageUrl: VITE_IMG,
    viteBackendUrl: VITE_BACKEND,
    pageOrigin: isBrowser ? window.location.origin : undefined,
  });
}

/** Origin (no trailing slash) prepended to ``/images/...`` from the API; empty = same-origin relative. */
export const IMAGE_BASE = computeImageBase();

export function productImageUrl(image_url: string): string {
  if (!image_url) return '';
  if (/^https?:\/\//i.test(image_url)) return image_url;
  return `${IMAGE_BASE}${image_url}`;
}
