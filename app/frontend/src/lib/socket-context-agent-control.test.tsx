/**
 * Simulates agent → patron Socket.IO pushes (same shape the backend emits after
 * ``agent_emit`` / stylist envelopes) and asserts ``SocketProvider`` context updates.
 */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';

import type { StylistWsMessageV1 } from '../services/chatApi';
import { SocketProvider, useSocket } from './socket-context';

const SESSION_ID = 'ci-test-session-001';

const socketHarness = vi.hoisted(() => {
  let fire: (ev: string, ...args: unknown[]) => void = () => {};
  const mockIo = vi.fn(() => {
    const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
    const sock = {
      on(ev: string, fn: (...args: unknown[]) => void) {
        (handlers[ev] ??= []).push(fn);
        return sock;
      },
      emit: vi.fn(),
      disconnect: vi.fn(),
    };
    fire = (ev, ...args) => {
      for (const h of handlers[ev] ?? []) {
        h(...args);
      }
    };
    return sock;
  });
  return { mockIo, getFire: () => fire };
});

vi.mock('socket.io-client', () => ({
  io: socketHarness.mockIo,
}));

function ContextProbe() {
  const s = useSocket();
  return (
    <div>
      <span data-testid="connected">{String(s.connected)}</span>
      <span data-testid="ui-action">{s.lastUiAction?.action ?? ''}</span>
      <span data-testid="ui-path">{String((s.lastUiAction?.payload as { path?: string })?.path ?? '')}</span>
      <span data-testid="shop-gender">{s.lastShopSync?.gender ?? ''}</span>
      <span data-testid="shop-category">{s.lastShopSync?.category ?? ''}</span>
      <span data-testid="catalog-mode">{s.lastStylistCatalog?.mode ?? ''}</span>
      <span data-testid="catalog-n">{String(s.lastStylistCatalog?.products.length ?? 0)}</span>
      <span data-testid="found-content">{s.lastStylistFound?.content ?? ''}</span>
      <span data-testid="reply">{s.lastStylistReply?.reply ?? ''}</span>
    </div>
  );
}

function stylistEnvelope(
  action: StylistWsMessageV1['action'],
  payload: Record<string, unknown>,
  tool: string | null = 'keyword_search',
): StylistWsMessageV1 {
  return {
    schema: 'sd.stylist.v1',
    session_id: SESSION_ID,
    source: 'tool',
    tool,
    action,
    payload,
    meta: {},
  };
}

describe('SocketProvider — agent controls frontend (simulated Socket.IO)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('reflects ui_action (e.g. navigate) in context', async () => {
    render(
      <SocketProvider sessionId={SESSION_ID}>
        <ContextProbe />
      </SocketProvider>,
    );

    await waitFor(() => expect(socketHarness.mockIo).toHaveBeenCalled());

    await act(async () => {
      socketHarness.getFire()('connect');
    });
    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('true'));

    await act(async () => {
      socketHarness.getFire()('ui_action', {
        action: 'navigate',
        payload: { path: '/shop' },
      });
    });

    expect(screen.getByTestId('ui-action')).toHaveTextContent('navigate');
    expect(screen.getByTestId('ui-path')).toHaveTextContent('/shop');
  });

  it('reflects sd_stylist_message shop_sync in lastShopSync', async () => {
    render(
      <SocketProvider sessionId={SESSION_ID}>
        <ContextProbe />
      </SocketProvider>,
    );

    await waitFor(() => expect(socketHarness.mockIo).toHaveBeenCalled());
    await act(async () => {
      socketHarness.getFire()('connect');
    });
    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('true'));

    await act(async () => {
      socketHarness.getFire()(
        'sd_stylist_message',
        stylistEnvelope('shop_sync', {
          gender: 'WOMEN',
          category: 'Dresses',
          query: 'silk',
        }),
      );
    });

    expect(screen.getByTestId('shop-gender')).toHaveTextContent('WOMEN');
    expect(screen.getByTestId('shop-category')).toHaveTextContent('Dresses');
  });

  it('reflects sd_stylist_message catalog_results in lastStylistCatalog', async () => {
    render(
      <SocketProvider sessionId={SESSION_ID}>
        <ContextProbe />
      </SocketProvider>,
    );

    await waitFor(() => expect(socketHarness.mockIo).toHaveBeenCalled());
    await act(async () => {
      socketHarness.getFire()('connect');
    });
    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('true'));

    await act(async () => {
      socketHarness.getFire()(
        'sd_stylist_message',
        stylistEnvelope(
          'catalog_results',
          {
            products: [{ product_id: 'p1', product_name: 'Tee', description: '', gender: 'MEN', category: 'Tees', price: 10, image_url: '/x' }],
            mode: 'agent_curated',
          },
          'gemini_close',
        ),
      );
    });

    expect(screen.getByTestId('catalog-mode')).toHaveTextContent('agent_curated');
    expect(screen.getByTestId('catalog-n')).toHaveTextContent('1');
  });

  it('ignores sd_stylist_message for a different session_id', async () => {
    render(
      <SocketProvider sessionId={SESSION_ID}>
        <ContextProbe />
      </SocketProvider>,
    );

    await waitFor(() => expect(socketHarness.mockIo).toHaveBeenCalled());
    await act(async () => {
      socketHarness.getFire()('connect');
    });
    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('true'));

    await act(async () => {
      socketHarness.getFire()('sd_stylist_message', {
        schema: 'sd.stylist.v1',
        session_id: 'other-session',
        source: 'tool',
        tool: 'x',
        action: 'shop_sync',
        payload: { gender: 'MEN', category: '', query: '' },
        meta: {},
      });
    });

    expect(screen.getByTestId('shop-gender')).toHaveTextContent('');
  });

  it('clearUiAction resets agent-driven ui_action', async () => {
    function ClearProbe() {
      const s = useSocket();
      return (
        <div>
          <span data-testid="ui-action">{s.lastUiAction?.action ?? ''}</span>
          <button type="button" onClick={() => s.clearUiAction()}>
            clear
          </button>
        </div>
      );
    }

    render(
      <SocketProvider sessionId={SESSION_ID}>
        <ClearProbe />
      </SocketProvider>,
    );

    await waitFor(() => expect(socketHarness.mockIo).toHaveBeenCalled());

    await act(async () => {
      socketHarness.getFire()('ui_action', { action: 'scroll_to_shop', payload: {} });
    });
    expect(screen.getByTestId('ui-action')).toHaveTextContent('scroll_to_shop');

    await act(async () => {
      screen.getByRole('button', { name: /clear/i }).click();
    });
    expect(screen.getByTestId('ui-action')).toHaveTextContent('');
  });
});
