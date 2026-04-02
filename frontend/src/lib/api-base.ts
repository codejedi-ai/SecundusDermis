/**
 * API URLs are relative to the page origin (no Vite env vars).
 * Dev: Vite proxies /api → FastAPI. Prod: nginx does the same.
 */
export const API_BASE = '/api';
export const IMAGE_BASE = '';

/** Origin for Socket.IO (same host as the SPA, /socket.io on nginx). */
export function socketOrigin(): string {
  const stripped = API_BASE.replace(/\/api\/?$/, '');
  if (stripped) return stripped;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
