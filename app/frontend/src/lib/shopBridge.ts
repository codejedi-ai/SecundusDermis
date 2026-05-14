/**
 * Pure helpers for patron ↔ agent shop state (Suite A) and Socket.IO shop_sync (Suite B).
 * Keeps merge rules testable without mounting the full React tree.
 */

import type { ShopContextPayload } from '../services/chatApi';

export type ShopFields = {
  gender: string;
  category: string;
  query: string;
  inputValue: string;
};

/**
 * Suite B — backend `shop_sync` event → same field updates as `ShopSocketSync` in main.tsx.
 */
export function mergeShopSyncPayload(prev: ShopFields, payload: ShopContextPayload): ShopFields {
  const next = { ...prev };
  if ('gender' in payload) next.gender = (payload.gender ?? '').trim();
  if ('category' in payload) next.category = (payload.category ?? '').trim();
  if ('query' in payload) {
    const q = (payload.query ?? '').trim();
    next.query = q;
    next.inputValue = q;
  }
  return next;
}

/**
 * Suite A — same snapshot patron chat sends as `shop_context` on `POST /api/patron/agent/chat/stream`.
 */
export function shopContextForChatRequest(shop: {
  gender: string;
  category: string;
  query: string;
}): ShopContextPayload {
  return {
    gender: shop.gender || undefined,
    category: shop.category || undefined,
    query: shop.query || undefined,
  };
}
