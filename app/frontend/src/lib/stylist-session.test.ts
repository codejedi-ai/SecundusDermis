import { describe, expect, it } from 'vitest';
import { sanitizeStylistSessionId } from './stylist-session';

describe('sanitizeStylistSessionId', () => {
  it('allows letters, digits, underscore, hyphen', () => {
    expect(sanitizeStylistSessionId('eval_run-1')).toBe('eval_run-1');
    expect(sanitizeStylistSessionId('default')).toBe('default');
  });

  it('truncates to 64 chars', () => {
    const long = 'a'.repeat(80);
    expect(sanitizeStylistSessionId(long).length).toBe(64);
  });

  it('falls back to default for empty or invalid', () => {
    expect(sanitizeStylistSessionId('')).toBe('default');
    expect(sanitizeStylistSessionId('   ')).toBe('default');
    expect(sanitizeStylistSessionId('has space')).toBe('default');
    expect(sanitizeStylistSessionId('unicode-λ')).toBe('default');
  });
});
