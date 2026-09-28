// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ConnectionState } from '@/types';

/** Minimal stand-in for the PocketBase client's realtime surface. */
const fake = vi.hoisted(() => {
  const state = {
    isConnected: false,
    failNextSubscribe: false,
    connectListeners: new Set<() => void>(),
    collectionSubscribe: undefined as unknown as Mock,
    realtime: {} as {
      readonly isConnected: boolean;
      onDisconnect?: (subscriptions: string[]) => void;
      subscribe: (topic: string, cb: () => void) => Promise<() => Promise<void>>;
    },
  };
  return state;
});

vi.mock('@/lib/pocketbase/client', () => ({
  pb: {
    authStore: { isValid: true },
    collection: () => ({ subscribe: fake.collectionSubscribe }),
    get realtime() {
      return fake.realtime;
    },
  },
}));

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Simulate the SDK (re)connecting: connected, then PB_CONNECT listeners. */
function connect() {
  fake.isConnected = true;
  fake.connectListeners.forEach((listener) => listener());
}

beforeEach(() => {
  vi.resetModules();
  fake.isConnected = false;
  fake.failNextSubscribe = false;
  fake.connectListeners = new Set();
  // Like the SDK: subscribing while disconnected opens the connection, and
  // PB_CONNECT listeners run before the subscribe() promise resolves.
  fake.collectionSubscribe = vi.fn(async () => {
    await Promise.resolve(); // let the hook register its PB_CONNECT listener
    if (fake.failNextSubscribe) {
      fake.failNextSubscribe = false;
      throw new Error('connect failed');
    }
    if (!fake.isConnected) {
      connect();
    }
    return async () => {};
  });
  fake.realtime = {
    get isConnected() {
      return fake.isConnected;
    },
    subscribe: async (topic: string, cb: () => void) => {
      if (topic === 'PB_CONNECT') fake.connectListeners.add(cb);
      return async () => {
        fake.connectListeners.delete(cb);
      };
    },
  };
  setHidden(false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function load() {
  const { useRealtimeSubscription } = await import('../use-realtime-subscription');
  const { useRealtimeConnection } = await import('../use-realtime-connection');
  return { useRealtimeSubscription, useRealtimeConnection };
}

describe('useRealtimeSubscription onResubscribe', () => {
  it('is not called for the first subscription, but after the tab was hidden and shown again', async () => {
    const { useRealtimeSubscription } = await load();
    const onResubscribe = vi.fn();
    renderHook(() => useRealtimeSubscription('item', { onResubscribe }));

    await waitFor(() => expect(fake.collectionSubscribe).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(onResubscribe).not.toHaveBeenCalled();

    // Hidden: the hook unsubscribes and the SDK closes the connection
    act(() => setHidden(true));
    fake.isConnected = false;
    act(() => setHidden(false));
    await waitFor(() => expect(fake.collectionSubscribe).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onResubscribe).toHaveBeenCalled());
    await act(async () => {});
    // Once, although the resumed subscription's connect also fired PB_CONNECT
    expect(onResubscribe).toHaveBeenCalledTimes(1);
  });

  it('is called when the SDK re-establishes a dropped connection', async () => {
    const { useRealtimeSubscription } = await load();
    const onResubscribe = vi.fn();
    renderHook(() => useRealtimeSubscription('rental', { onResubscribe }));

    await waitFor(() => expect(fake.collectionSubscribe).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(onResubscribe).not.toHaveBeenCalled();

    // Connection drops and comes back; the SDK fires PB_CONNECT
    fake.realtime.onDisconnect?.(['rental/*']);
    fake.isConnected = false;
    await act(async () => {});
    act(() => connect());
    expect(onResubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('useRealtimeConnection', () => {
  it('reports a dropped connection as Connecting and its recovery as Connected', async () => {
    const { useRealtimeSubscription, useRealtimeConnection } = await load();
    renderHook(() => useRealtimeSubscription('item', {}));
    const { result } = renderHook(() => useRealtimeConnection());

    await waitFor(() => expect(fake.collectionSubscribe).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.state).toBe(ConnectionState.Connected);

    fake.realtime.onDisconnect?.(['item/*']);
    fake.isConnected = false;
    await waitFor(() => expect(result.current.state).toBe(ConnectionState.Connecting));

    act(() => connect());
    expect(result.current.state).toBe(ConnectionState.Connected);
  });

  it('does not report an intentional disconnect (nothing subscribed) as a problem', async () => {
    const { useRealtimeSubscription, useRealtimeConnection } = await load();
    const sub = renderHook(() => useRealtimeSubscription('item', {}));
    const { result } = renderHook(() => useRealtimeConnection());
    await waitFor(() => expect(fake.collectionSubscribe).toHaveBeenCalled());
    await act(async () => {});

    sub.unmount();
    fake.realtime.onDisconnect?.([]);
    fake.isConnected = false;
    await act(async () => {});
    expect(result.current.state).toBe(ConnectionState.Connected);
  });

  it('reports a failed first connect as an error, and reconnect() re-subscribes', async () => {
    const { useRealtimeSubscription, useRealtimeConnection } = await load();
    fake.failNextSubscribe = true;
    const onResubscribe = vi.fn();
    renderHook(() => useRealtimeSubscription('item', { onResubscribe }));
    const { result } = renderHook(() => useRealtimeConnection());

    await waitFor(() => expect(result.current.state).toBe(ConnectionState.Error));
    expect(result.current.error).toBeTruthy();

    act(() => result.current.reconnect());
    expect(result.current.state).toBe(ConnectionState.Connecting);
    await waitFor(() => expect(fake.collectionSubscribe).toHaveBeenCalledTimes(2));

    await waitFor(() => expect(result.current.state).toBe(ConnectionState.Connected));
    // The page's data predates the working subscription: let it catch up
    expect(onResubscribe).toHaveBeenCalledTimes(1);
  });
});
