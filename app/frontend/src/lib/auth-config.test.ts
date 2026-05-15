import { describe, expect, it } from 'vitest';
import { AUTH_ENABLED, EPHEMERAL_MODE } from './auth-config';

describe('auth / ephemeral mode flags', () => {
  it('reads Vite env (false in local .env when sign-in disconnected)', () => {
    expect(typeof AUTH_ENABLED).toBe('boolean');
  });

  it('EPHEMERAL_MODE is the inverse of AUTH_ENABLED', () => {
    expect(EPHEMERAL_MODE).toBe(!AUTH_ENABLED);
  });
});
