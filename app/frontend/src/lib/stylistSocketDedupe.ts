/**
 * Dedupe Socket.IO stylist envelopes against the same turn delivered over SSE.
 */

import type { Product } from '../services/chatApi';

export type ProductIdLike = Pick<Product, 'product_id'>;

/** Stable fingerprint for final reply + product set (order-insensitive on ids). */
export function fingerprintStylistReply(reply: string, products: ProductIdLike[]): string {
  const ids = [...products].map((p) => String(p.product_id)).sort().join(',');
  return `${reply.trim().length}:${ids}`;
}

export function fingerprintProductIds(products: ProductIdLike[]): string {
  return [...products].map((p) => String(p.product_id)).sort().join(',');
}

/** When SSE already applied this turn's final, ignore the same stylist_reply from Socket.IO. */
export function shouldSkipDuplicateStylistReply(args: {
  socketReply: string;
  socketProducts: ProductIdLike[];
  sseFinalFingerprint: string | null;
}): boolean {
  if (!args.sseFinalFingerprint) return false;
  return (
    fingerprintStylistReply(args.socketReply, args.socketProducts) === args.sseFinalFingerprint
  );
}

/** Skip socket found_products if we already showed the same product ids this turn (e.g. SSE won). */
export function shouldSkipDuplicateFoundProducts(args: {
  socketProducts: ProductIdLike[];
  seenFingerprints: Set<string>;
}): boolean {
  const fp = fingerprintProductIds(args.socketProducts);
  return args.seenFingerprints.has(fp);
}
