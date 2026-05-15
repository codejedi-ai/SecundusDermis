/**
 * Patron sign-in gate — disconnect without deleting auth code.
 * Set ``VITE_AUTH_ENABLED=false`` in ``app/frontend/.env`` (keep in sync with backend ``AUTH_ENABLED``).
 *
 * **Ephemeral mode** (``EPHEMERAL_MODE``): ``AUTH_ENABLED`` is false — demo deployment with no
 * accounts, no persistent chat history, and a fresh stylist thread per browser tab.
 */
export const AUTH_ENABLED =
  (import.meta.env.VITE_AUTH_ENABLED as string | undefined)?.trim().toLowerCase() !== 'false';

/** Demo mode: sign-in off, chat not persisted across visits (see ``convo-context``). */
export const EPHEMERAL_MODE = !AUTH_ENABLED;

/** Route prefixes disabled when ``AUTH_ENABLED`` is false (keep in sync with ``main.tsx``). */
export const PATRON_AUTH_ROUTE_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/signin',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/account',
  '/cart',
  '/agents',
] as const;
