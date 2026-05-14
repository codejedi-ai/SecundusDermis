/**
 * User-visible strings for the floating / embedded stylist chat.
 */

export function userFacingChatSendError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const low = msg.toLowerCase();
  if (low.includes('failed to fetch') || low.includes('networkerror') || low === 'network error') {
    return 'Could not reach the API from this page. If you use the Vite dev server, run the backend on port 8000 so `/api` is proxied.';
  }
  if (/\b401\b|\b403\b/.test(msg)) {
    return 'Patron API key was rejected. Open AI agents → API keys and save a valid `sdag_…` key.';
  }
  if (/\b503\b/.test(msg) || low.includes('not configured') || low.includes('agent_internal_secret')) {
    return 'No default agent selected.';
  }
  return 'No default agent selected.';
}
