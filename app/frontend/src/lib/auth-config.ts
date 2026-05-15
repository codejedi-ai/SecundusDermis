/**
 * Patron sign-in gate — disconnect without deleting auth code.
 * Set ``VITE_AUTH_ENABLED=false`` in ``app/frontend/.env`` (keep in sync with backend ``AUTH_ENABLED``).
 *
 * When false: all routes under ``PatronAuthOutlet`` redirect home (sign-in, account, cart, agents);
 * nav links to those pages are hidden. Public shop + corner stylist (guest house key) stay available.
 */
export const AUTH_ENABLED =
  (import.meta.env.VITE_AUTH_ENABLED as string | undefined)?.trim().toLowerCase() !== 'false';

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
