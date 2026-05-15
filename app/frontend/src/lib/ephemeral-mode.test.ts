import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth-config', () => ({
  AUTH_ENABLED: false,
  EPHEMERAL_MODE: true,
}));

describe('ephemeral mode', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('uses a guest stylist session id per browser tab', async () => {
    const { loadPersistedStylistSessionId } = await import('./stylist-session');
    const id = loadPersistedStylistSessionId();
    expect(id).toMatch(/^guest-/);
    expect(sessionStorage.getItem('sd_stylist_session_id_guest')).toBe(id);
  });

  it('starts chat from welcome only (no localStorage transcript)', async () => {
    const { buildInitialConvoMessage } = await import('./convo-context');
    localStorage.setItem(
      'sd_chat_messages_anon',
      JSON.stringify([{ id: 'old', role: 'user', content: 'saved', timestamp: 1 }]),
    );
    expect(buildInitialConvoMessage().id).toBe('init');
  });
});
