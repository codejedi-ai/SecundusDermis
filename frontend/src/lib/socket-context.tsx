/**
 * socket-context.tsx
 *
 * Persistent Socket.IO connection to the FastAPI backend.
 *
 * - Connects to the same origin as the SPA (nginx proxies /socket.io).
 * - Joins a per-session "room" so the backend can push events targeted
 *   at this browser session.
 * - Automatically reconnects on network drops.
 *
 * Events the backend may push:
 *   ui_action   — agent controls the frontend UI
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
import type { UiAction } from '../services/chatApi';

import { socketOrigin } from './api-base';

// ── Types ──────────────────────────────────────────────────────────────────

interface SocketContextType {
  connected: boolean;
  /** The latest ui_action pushed by the backend agent. */
  lastUiAction: UiAction | null;
  /** Clear the last ui_action after it has been consumed. */
  clearUiAction: () => void;
  /** Emit a custom event to the backend (for future bidirectional use). */
  emit: (event: string, data?: unknown) => void;
}

const SocketContext = createContext<SocketContextType>({
  connected: false,
  lastUiAction: null,
  clearUiAction: () => {},
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

  useEffect(() => {
    if (!sessionId) return;

    const socket = io(socketOrigin(), {
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

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  const emit = (event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  };

  const clearUiAction = () => setLastUiAction(null);

  return (
    <SocketContext.Provider value={{ connected, lastUiAction, clearUiAction, emit }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
