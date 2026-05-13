/**
 * socket-context.tsx
 *
 * Persistent Socket.IO connection to the FastAPI backend.
 *
 * - Connects to the backend at VITE_API_URL (minus the /api prefix).
 * - Joins a per-session "room" so the backend can push events targeted
 *   at this browser session.
 * - Automatically reconnects on network drops.
 *
 * Events the backend may push:
 *   ui_action   — agent controls the frontend UI
 *   shop_sync   — canonical gender/category/query from agent shop_state
 *   notification — toast / alert message
 *   pong        — reply to a client ping
 *   connected   — room-join confirmation
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import type { ShopContextPayload, UiAction } from '../services/chatApi';

// Strip /api suffix from VITE_API_URL to get the bare server origin.
const RAW_API = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
const SOCKET_ORIGIN = RAW_API.replace(/\/api\/?$/, '') || window.location.origin;

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
  /** Emit a custom event to the backend (for future bidirectional use). */
  emit: (event: string, data?: unknown) => void;
}

const SocketContext = createContext<SocketContextType>({
  connected: false,
  lastUiAction: null,
  clearUiAction: () => {},
  lastShopSync: null,
  clearShopSync: () => {},
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

  useEffect(() => {
    if (!sessionId) return;

    const socket = io(SOCKET_ORIGIN, {
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

    /** Backend agent is controlling the frontend UI. */
    socket.on('ui_action', (action: UiAction) => {
      console.info('[socket] ui_action received:', action);
      setLastUiAction(action);
    });

    socket.on('shop_sync', (payload: ShopContextPayload) => {
      console.info('[socket] shop_sync received:', payload);
      setLastShopSync(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  const emit = (event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  };

  const clearUiAction = () => setLastUiAction(null);
  const clearShopSync = () => setLastShopSync(null);

  return (
    <SocketContext.Provider
      value={{
        connected,
        lastUiAction,
        clearUiAction,
        lastShopSync,
        clearShopSync,
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
