/**
 * User-visible strings for the floating / embedded stylist chat.
 */

export type ChatSendErrorContext = {
  /** Boutique uses the auto house ``sdag_…``; Atelier may use browser session or onboarded agents. */
  boutique?: boolean;
};

export function userFacingChatSendError(err: unknown, ctx?: ChatSendErrorContext): string {
  const msg = err instanceof Error ? err.message : String(err);
  const low = msg.toLowerCase();
  if (low.includes('failed to fetch') || low.includes('networkerror') || low === 'network error') {
    return 'Could not reach the API from this page. If you use the Vite dev server, run the backend on port 8000 so `/api` is proxied.';
  }
  if (/\b401\b|\b403\b/.test(msg)) {
    return 'Your session was rejected or expired. Try signing in again.';
  }
  if (/\b503\b/.test(msg) || low.includes('not configured') || low.includes('agent_internal_secret')) {
    return ctx?.boutique
      ? 'The house stylist is not available yet. Run ./app/run.sh dev (or set AGENT_SERVICE_URL and start the agent).'
      : 'Stylist service is not available. Check AGENT_SERVICE_URL and the agent process on the deployment.';
  }
  return ctx?.boutique
    ? 'The house stylist could not reply. Try again in a moment.'
    : 'Stylist could not complete this turn. Try again or pick a session on the Agents page.';
}

export function emptyStylistTurnMessage(ctx?: ChatSendErrorContext): string {
  return ctx?.boutique
    ? 'The house stylist had nothing to add for that turn. Try rephrasing or ask for a specific category.'
    : 'No reply from the stylist for that turn. Try again or check your agent session on the Agents page.';
}
