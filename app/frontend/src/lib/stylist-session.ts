/**
 * Browser-persisted chat `session_id` (`POST /api/browser/agent/chat/stream` + Socket.IO `sd_<id>`).
 * Account transcripts still use auth `session-id` on `/conversations` — see convo-context.
 */

export const STYLIST_SESSION_STORAGE_KEY = 'sd_stylist_session_id';

export interface StylistAgentOption {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
}

/** Built-in threads users can pick as their default stylist chat session. */
export const STYLIST_AGENT_OPTIONS: readonly StylistAgentOption[] = [
  {
    id: 'default',
    label: 'Default thread',
    hint: 'Same as the API default — shared “house” chat thread.',
  },
  {
    id: 'explore',
    label: 'Explore thread',
    hint: 'Separate tool thread (Socket room sd_explore).',
  },
  {
    id: 'eval',
    label: 'Evaluation / harness',
    hint: 'For scripted runs or external eval (Socket room sd_eval).',
  },
] as const;

const PRESET_IDS = new Set(STYLIST_AGENT_OPTIONS.map((o) => o.id));

/** Safe token for session_id / room suffix: [a-zA-Z0-9_-], 1–64 chars. */
export function sanitizeStylistSessionId(raw: string): string {
  const t = (raw || '').trim().slice(0, 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return 'default';
  return t;
}

export function loadPersistedStylistSessionId(): string {
  try {
    const v = localStorage.getItem(STYLIST_SESSION_STORAGE_KEY);
    return sanitizeStylistSessionId(v || 'default');
  } catch {
    return 'default';
  }
}

export function savePersistedStylistSessionId(id: string): void {
  try {
    localStorage.setItem(STYLIST_SESSION_STORAGE_KEY, sanitizeStylistSessionId(id));
  } catch {
    /* quota / private mode */
  }
}

export function isPresetStylistSessionId(id: string): boolean {
  return PRESET_IDS.has(sanitizeStylistSessionId(id));
}
