/**
 * Auto-provisioned **house stylist** patron key (boutique in-browser chat).
 * Fetched from ``GET /api/auth/house-agent-key`` after sign-in; not the Agents hub.
 */

import { API_BASE } from './api-base';

const CACHE_KEY = 'sd_house_agent_key';

export function readCachedHouseAgentKey(): string | null {
  try {
    const v = sessionStorage.getItem(CACHE_KEY)?.trim();
    return v && v.startsWith('sdag_') ? v : null;
  } catch {
    return null;
  }
}

export function clearHouseAgentKeyCache(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/** Mint or return the server-side house ``sdag_…`` for this signed-in patron. */
export async function fetchHouseAgentKey(browserSessionId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/house-agent-key`, {
    credentials: 'include',
    headers: { 'session-id': browserSessionId },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  const data = (await res.json()) as { token?: string };
  const token = (data.token || '').trim();
  if (!token.startsWith('sdag_')) {
    throw new Error('Invalid house agent key response');
  }
  try {
    sessionStorage.setItem(CACHE_KEY, token);
  } catch {
    /* ignore */
  }
  return token;
}
