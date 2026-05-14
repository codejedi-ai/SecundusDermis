import { describe, expect, it } from 'vitest';
import { parseApiErrorDetail } from './api-error';

describe('parseApiErrorDetail', () => {
  it('returns string detail', () => {
    expect(parseApiErrorDetail({ detail: 'Wrong pass' }, '{}', 'fb')).toBe('Wrong pass');
  });

  it('joins pydantic-style array', () => {
    const body = { detail: [{ msg: 'a' }, { msg: 'b' }] };
    expect(parseApiErrorDetail(body, '', 'fb')).toBe('a b');
  });

  it('uses fallback when detail missing', () => {
    expect(parseApiErrorDetail({}, '', 'fb')).toBe('fb');
  });
});
