import { describe, expect, it } from 'vitest';
import {
  fingerprintProductIds,
  fingerprintStylistReply,
  shouldSkipDuplicateFoundProducts,
  shouldSkipDuplicateStylistReply,
} from './stylistSocketDedupe';

describe('stylistSocketDedupe', () => {
  const p = (id: string) => ({ product_id: id });

  it('fingerprintStylistReply ignores product order', () => {
    const a = fingerprintStylistReply('Hello', [p('b'), p('a')]);
    const b = fingerprintStylistReply('Hello', [p('a'), p('b')]);
    expect(a).toBe(b);
  });

  it('fingerprintStylistReply changes when reply length changes', () => {
    const a = fingerprintStylistReply('Hi', [p('1')]);
    const b = fingerprintStylistReply('Hello', [p('1')]);
    expect(a).not.toBe(b);
  });

  it('shouldSkipDuplicateStylistReply when SSE fingerprint matches', () => {
    const sse = fingerprintStylistReply('Done', [p('x'), p('y')]);
    expect(
      shouldSkipDuplicateStylistReply({
        socketReply: 'Done',
        socketProducts: [p('y'), p('x')],
        sseFinalFingerprint: sse,
      }),
    ).toBe(true);
  });

  it('should not skip when no SSE fingerprint (second tab)', () => {
    expect(
      shouldSkipDuplicateStylistReply({
        socketReply: 'Done',
        socketProducts: [p('1')],
        sseFinalFingerprint: null,
      }),
    ).toBe(false);
  });

  it('fingerprintProductIds for found_products dedupe', () => {
    expect(fingerprintProductIds([p('z'), p('a')])).toBe(fingerprintProductIds([p('a'), p('z')]));
  });

  it('shouldSkipDuplicateFoundProducts uses seen set', () => {
    const seen = new Set<string>([fingerprintProductIds([p('1')])]);
    expect(
      shouldSkipDuplicateFoundProducts({
        socketProducts: [p('1')],
        seenFingerprints: seen,
      }),
    ).toBe(true);
    expect(
      shouldSkipDuplicateFoundProducts({
        socketProducts: [p('2')],
        seenFingerprints: seen,
      }),
    ).toBe(false);
  });
});
