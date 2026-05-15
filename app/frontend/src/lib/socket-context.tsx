/**
 * socket-context.tsx
 *
 * Persistent Socket.IO connection to the FastAPI backend.
 *
 * - Connects at ``socketIoOrigin()`` (see ``api-base.ts``): page origin when ``API_BASE`` is ``/api``,
 *   otherwise the origin of a full ``VITE_API_URL`` build (production split-origin).
 * - Joins a per-session "room" so the backend can push events targeted
 *   at this browser session.
 * - Automatically reconnects on network drops.
 *
 * Events the backend may push (``sd_stylist_message`` is merged into the stylist chat panel in real time):
 *   sd_stylist_message — versioned stylist envelope (schema sd.stylist.v1); action shop_sync carries shop payload
 *   ui_action   — agent controls the frontend UI
 *   notification — toast / alert message
 *   pong        — reply to a client ping
 *   connected   — room-join confirmation
 *   deployment_stats — same payload as ``GET /api/catalog/stats`` (``/agents`` deployment panel; join via ``join_deployment_stats``)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  Product,
  ShopContextPayload,
  StylistWsCatalogSnapshot,
  StylistWsFoundSnapshot,
  StylistWsMessageV1,
  StylistWsReplySnapshot,
  UiAction,
} from '../services/chatApi';
import type { CatalogStats } from '../services/fashionApi';
import { socketIoOrigin } from './api-base';

function isStylistWsMessageV1(raw: unknown): raw is StylistWsMessageV1 {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    o.schema === 'sd.stylist.v1' &&
    typeof o.session_id === 'string' &&
    typeof o.action === 'string' &&
    typeof o.payload === 'object' &&
    o.payload !== null
  );
}

function parseCatalogSnapshot(payload: Record<string, unknown>): StylistWsCatalogSnapshot | null {
  const products = payload.products;
  const mode = payload.mode;
  if (!Array.isArray(products) || typeof mode !== 'string') return null;
  return { products: products as Product[], mode };
}

function parseFoundSnapshot(payload: Record<string, unknown>): StylistWsFoundSnapshot | null {
  const content = payload.content;
  const products = payload.products;
  if (typeof content !== 'string' || !Array.isArray(products)) return null;
  const count = typeof payload.count === 'number' ? payload.count : products.length;
  return { content, products: products as Product[], count };
}

function parseReplySnapshot(payload: Record<string, unknown>): StylistWsReplySnapshot | null {
  const reply = payload.reply;
  const products = payload.products;
  const intent = payload.intent;
  if (typeof reply !== 'string' || !Array.isArray(products) || typeof intent !== 'string') return null;
  const filter = payload.filter;
  return {
    reply,
    products: products as Product[],
    intent,
    filter: filter && typeof filter === 'object' ? (filter as Record<string, unknown>) : {},
  };
}

// ── Types ──────────────────────────────────────────────────────────────────

interface SocketContextType {
  connected: boolean;
  /** The latest ui_action pushed by the backend agent. */
  lastUiAction: UiAction | null;
  /** Clear the last ui_action after it has been consumed. */
  clearUiAction: () => void;
  /** Latest shop_state snapshot (gender, category, search bar) from the agent. */
  lastShopSync: ShopContextPayload | null;
  clearShopSync: () => void;
  /** Latest ``catalog_results`` action from ``sd_stylist_message`` (for live chat UI). */
  lastStylistCatalog: StylistWsCatalogSnapshot | null;
  clearStylistCatalog: () => void;
  /** Latest ``found_products`` mid-turn spotlight from Socket.IO. */
  lastStylistFound: StylistWsFoundSnapshot | null;
  clearStylistFound: () => void;
  /** Latest ``stylist_reply`` final summary from Socket.IO (dedupe vs SSE in patron chat stream). */
  lastStylistReply: StylistWsReplySnapshot | null;
  clearStylistReply: () => void;
  /** Latest deployment snapshot (``GET /api/catalog/stats``) when subscribed from ``/agents``. */
  lastDeploymentStats: CatalogStats | null;
  clearDeploymentStats: () => void;
  /** Emit a custom event to the backend (for future bidirectional use). */
  emit: (event: string, data?: unknown) => void;
}

const SocketContext = createContext<SocketContextType>({
  connected: false,
  lastUiAction: null,
  clearUiAction: () => {},
  lastShopSync: null,
  clearShopSync: () => {},
  lastStylistCatalog: null,
  clearStylistCatalog: () => {},
  lastStylistFound: null,
  clearStylistFound: () => {},
  lastStylistReply: null,
  clearStylistReply: () => {},
  lastDeploymentStats: null,
  clearDeploymentStats: () => {},
  emit: () => {},
});

// ── Provider ───────────────────────────────────────────────────────────────

export function SocketProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: React.ReactNode;
}) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUiAction, setLastUiAction] = useState<UiAction | null>(null);
  const [lastShopSync, setLastShopSync] = useState<ShopContextPayload | null>(null);
  const [lastStylistCatalog, setLastStylistCatalog] = useState<StylistWsCatalogSnapshot | null>(null);
  const [lastStylistFound, setLastStylistFound] = useState<StylistWsFoundSnapshot | null>(null);
  const [lastStylistReply, setLastStylistReply] = useState<StylistWsReplySnapshot | null>(null);
  const [lastDeploymentStats, setLastDeploymentStats] = useState<CatalogStats | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const origin = socketIoOrigin() || window.location.origin;
    const socket = io(origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // Auto-reconnect with exponential back-off
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Join the session-specific room
      socket.emit('join_session', { session_id: sessionId });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[socket] connect error:', err.message);
    });

    socket.on('deployment_stats', (payload: CatalogStats) => {
      setLastDeploymentStats(payload);
    });

    /** Backend agent is controlling the frontend UI. */
    socket.on('ui_action', (action: UiAction) => {
      console.info('[socket] ui_action received:', action);
      setLastUiAction(action);
    });

    socket.on('sd_stylist_message', (raw: unknown) => {
      if (!isStylistWsMessageV1(raw)) {
        console.warn('[socket] ignored invalid sd_stylist_message', raw);
        return;
      }
      if (raw.session_id !== sessionId) {
        console.warn('[socket] sd_stylist_message for wrong session', raw.session_id);
        return;
      }
      if (raw.action === 'shop_sync') {
        const payload = raw.payload as ShopContextPayload;
        console.info('[socket] sd_stylist_message shop_sync:', payload);
        setLastShopSync(payload);
        return;
      }
      if (raw.action === 'catalog_results') {
        const snap = parseCatalogSnapshot(raw.payload as Record<string, unknown>);
        if (snap) {
          console.info('[socket] sd_stylist_message catalog_results:', snap.mode, snap.products.length);
          setLastStylistCatalog(snap);
        }
        return;
      }
      if (raw.action === 'found_products') {
        const snap = parseFoundSnapshot(raw.payload as Record<string, unknown>);
        if (snap) {
          console.info('[socket] sd_stylist_message found_products:', snap.count);
          setLastStylistFound(snap);
        }
        return;
      }
      if (raw.action === 'stylist_reply') {
        const snap = parseReplySnapshot(raw.payload as Record<string, unknown>);
        if (snap) {
          console.info('[socket] sd_stylist_message stylist_reply');
          setLastStylistReply(snap);
        }
        return;
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setLastDeploymentStats(null);
    };
  }, [sessionId]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const clearUiAction = () => setLastUiAction(null);
  const clearShopSync = () => setLastShopSync(null);
  const clearStylistCatalog = () => setLastStylistCatalog(null);
  const clearStylistFound = () => setLastStylistFound(null);
  const clearStylistReply = () => setLastStylistReply(null);
  const clearDeploymentStats = () => setLastDeploymentStats(null);

  return (
    <SocketContext.Provider
      value={{
        connected,
        lastUiAction,
        clearUiAction,
        lastShopSync,
        clearShopSync,
        lastStylistCatalog,
        clearStylistCatalog,
        lastStylistFound,
        clearStylistFound,
        lastStylistReply,
        clearStylistReply,
        lastDeploymentStats,
        clearDeploymentStats,
        emit,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
