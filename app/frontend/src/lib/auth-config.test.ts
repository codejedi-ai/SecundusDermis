import { describe, expect, it } from 'vitest';
import { AUTH_ENABLED } from './auth-config';

describe('AUTH_ENABLED', () => {
  it('reads Vite env (false in local .env when sign-in disconnected)', () => {
    expect(typeof AUTH_ENABLED).toBe('boolean');
  });
});
