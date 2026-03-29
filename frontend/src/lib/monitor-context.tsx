/**
 * MonitorContext — observes patron browser behaviour and reports it to
 * the backend so the AI can reference it in future conversations.
 *
 * Only reports when the patron is logged in. Anonymous sessions are ignored.
 *
 * Tracks:
 *   - Every page navigation (page_view)
 *   - Time spent on each page (page_dwell, if >= DWELL_THRESHOLD seconds)
 *   - Product pages visited (product_view)
 */
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';
import * as fashionApi from '../services/fashionApi';

const DWELL_THRESHOLD = 20; // seconds on a page before we consider it genuine interest

const MonitorContext = createContext<undefined>(undefined);

export function MonitorProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { session } = useAuth();
  const sessionId = session?.session_id ?? null;

  const startRef    = useRef<number>(Date.now());
  const prevPathRef = useRef<string>(location.pathname);
  // Store the product name from the page title if available
  const prevLabelRef = useRef<string>('');

  useEffect(() => {
    const prevPath  = prevPathRef.current;
    const prevLabel = prevLabelRef.current;
    const elapsed   = Math.round((Date.now() - startRef.current) / 1000);

    if (sessionId && elapsed >= DWELL_THRESHOLD) {
      // Report dwell on the page the patron just left
      const event = prevPath.startsWith('/product/') ? 'product_view' : 'page_dwell';
      fashionApi.recordActivity(sessionId, event, prevPath, prevLabel, elapsed);
    }

    // Reset for the new page
    prevPathRef.current  = location.pathname;
    prevLabelRef.current = document.title || '';
    startRef.current     = Date.now();

    // Also record a lightweight page_view immediately (only for logged-in)
    if (sessionId) {
      fashionApi.recordActivity(sessionId, 'page_view', location.pathname, document.title || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, sessionId]);

  // Update label when the document title changes (product pages set it after fetch)
  useEffect(() => {
    prevLabelRef.current = document.title || '';
  });

  return (
    <MonitorContext.Provider value={undefined}>
      {children}
    </MonitorContext.Provider>
  );
}

export function useMonitor() {
  return useContext(MonitorContext);
}
