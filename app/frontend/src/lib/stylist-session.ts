/**
 * Browser-persisted chat `session_id` (`POST /api/browser/agent/chat/stream` + Socket.IO `sd_<id>`).
 * Account transcripts still use auth `session-id` on `/conversations` — see convo-context.
 *
 * In **ephemeral mode**, the id lives in ``sessionStorage`` only (new id per browser tab).
 */

import { EPHEMERAL_MODE } from './auth-config';

export const STYLIST_SESSION_STORAGE_KEY = 'sd_stylist_session_id';
const GUEST_STYLIST_SESSION_KEY = 'sd_stylist_session_id_guest';

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

function newGuestStylistSessionId(): string {
  const suffix =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : String(Date.now());
  return sanitizeStylistSessionId(`guest-${suffix}`);
}

/** Stylist thread for ephemeral demo mode — one id per browser tab session. */
export function loadGuestStylistSessionId(): string {
  try {
    const existing = sessionStorage.getItem(GUEST_STYLIST_SESSION_KEY);
    if (existing) return sanitizeStylistSessionId(existing);
    const created = newGuestStylistSessionId();
    sessionStorage.setItem(GUEST_STYLIST_SESSION_KEY, created);
    return created;
  } catch {
    return newGuestStylistSessionId();
  }
}

export function loadPersistedStylistSessionId(): string {
  if (EPHEMERAL_MODE) {
    return loadGuestStylistSessionId();
  }
  try {
    const v = localStorage.getItem(STYLIST_SESSION_STORAGE_KEY);
    return sanitizeStylistSessionId(v || 'default');
  } catch {
    return 'default';
  }
}

export function savePersistedStylistSessionId(id: string): void {
  const safe = sanitizeStylistSessionId(id);
  try {
    if (EPHEMERAL_MODE) {
      sessionStorage.setItem(GUEST_STYLIST_SESSION_KEY, safe);
      return;
    }
    localStorage.setItem(STYLIST_SESSION_STORAGE_KEY, safe);
  } catch {
    /* quota / private mode */
  }
}

export function isPresetStylistSessionId(id: string): boolean {
  return PRESET_IDS.has(sanitizeStylistSessionId(id));
}
