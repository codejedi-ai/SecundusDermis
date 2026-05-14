import { describe, expect, it } from 'vitest';
import { mergeShopSyncPayload, shopContextForChatRequest } from './shopBridge';

describe('Suite B — mergeShopSyncPayload (backend shop_sync → UI state)', () => {
  const base = { gender: '', category: '', query: '', inputValue: '' };

  it('applies gender and category when present on payload', () => {
    const out = mergeShopSyncPayload(base, { gender: 'WOMEN', category: 'Dresses' });
    expect(out.gender).toBe('WOMEN');
    expect(out.category).toBe('Dresses');
    expect(out.query).toBe('');
    expect(out.inputValue).toBe('');
  });

  it('applies query to both query and inputValue', () => {
    const out = mergeShopSyncPayload(
      { gender: 'MEN', category: 'Denim', query: 'old', inputValue: 'old' },
      { query: 'slim fit' },
    );
    expect(out.gender).toBe('MEN');
    expect(out.category).toBe('Denim');
    expect(out.query).toBe('slim fit');
    expect(out.inputValue).toBe('slim fit');
  });

  it('does not clear unspecified keys (partial shop_sync)', () => {
    const prev = { gender: 'WOMEN', category: 'Skirts', query: 'midi', inputValue: 'midi' };
    const out = mergeShopSyncPayload(prev, { gender: 'WOMEN' });
    expect(out).toEqual(prev);
  });
});

describe('Suite A — shopContextForChatRequest (UI → chat stream body)', () => {
  it('omits empty strings so JSON matches optional shop_context', () => {
    expect(shopContextForChatRequest({ gender: '', category: '', query: '' })).toEqual({});
  });

  it('includes only non-empty fields', () => {
    expect(
      shopContextForChatRequest({ gender: 'WOMEN', category: '', query: 'linen' }),
    ).toEqual({ gender: 'WOMEN', query: 'linen' });
  });
});
