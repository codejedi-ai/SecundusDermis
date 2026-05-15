/**
 * Patron sign-in gate — disconnect without deleting auth code.
 * Set ``VITE_AUTH_ENABLED=false`` in ``app/frontend/.env`` (keep in sync with backend ``AUTH_ENABLED``).
 */
export const AUTH_ENABLED =
  (import.meta.env.VITE_AUTH_ENABLED as string | undefined)?.trim().toLowerCase() !== 'false';
