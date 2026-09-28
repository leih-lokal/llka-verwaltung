/**
 * PocketBase Real-Time Subscription Utilities
 * Provides helper functions for managing real-time subscriptions
 */

import {
  ConnectionState,
  type RealtimeEvent,
  type RealtimeAction,
  type RealtimeConnectionInfo,
} from '@/types';
import { pb } from './client';

/**
 * Format action for logging (e.g., 'create' -> 'created')
 */
export function formatAction(action: RealtimeAction): string {
  return `${action}d`;
}

/**
 * Log subscription event to console (development only)
 */
export function logRealtimeEvent<T extends { id?: string; collectionName?: string }>(
  event: RealtimeEvent<T>,
  collectionName?: string
): void {
  if (process.env.NODE_ENV === 'development') {
    const collection = collectionName || event.record.collectionName || 'unknown';
    const recordId = event.record.id || 'unknown';
    console.log(`[Realtime] ${collection} ${recordId} was ${formatAction(event.action)}`);
  }
}

// ============================================================================
// Connection state
// ============================================================================
//
// The SDK exposes `pb.realtime.isConnected` and a single `onDisconnect` hook
// (whose argument tells an interrupted connection from "unsubscribed from
// everything"); reconnects surface as PB_CONNECT events, which
// useRealtimeSubscription listens to and reports here. The SDK retries a
// dropped connection by itself, but gives up if the *first* connect fails.
//
// ConnectionState has no "idle" member, so while the app has no
// subscriptions (a page without realtime, or the tab hidden) the last state
// is kept: there is nothing to be disconnected from, and flipping to
// Disconnected would warn on every tab switch.

/** Disconnected (with subscriptions wanted) longer than this is an error. */
const OUTAGE_GRACE_MS = 10_000;
const OUTAGE_MESSAGE = 'Keine Verbindung zum Echtzeit-Server';

let activeSubscriptions = 0;
let reconnectGeneration = 0;
/** When the current disconnected-while-subscribed stretch started */
let disconnectedSince: number | null = null;
/** The connection was interrupted (as opposed to still being opened) */
let dropped = false;
/** A subscribe() failed; the SDK doesn't retry a failed first connect */
let subscribeFailed = false;
let graceTimer: ReturnType<typeof setTimeout> | null = null;

let connectionSnapshot: RealtimeConnectionInfo = { state: ConnectionState.Connected };
const connectionListeners = new Set<() => void>();
const reconnectListeners = new Set<() => void>();
const instrumentedServices = new WeakSet<object>();

/** Hook onDisconnect of the current client's realtime service (once each). */
function instrumentRealtimeService(): void {
  const realtime = pb.realtime;
  if (instrumentedServices.has(realtime)) return;
  instrumentedServices.add(realtime);

  const previous = realtime.onDisconnect;
  realtime.onDisconnect = (subscriptions) => {
    previous?.(subscriptions);
    // Non-empty: interrupted by the network/server. Empty: we unsubscribed.
    if (subscriptions.length > 0) {
      dropped = true;
    }
    // The SDK calls this before it clears the connection; look afterwards.
    queueMicrotask(refreshRealtimeConnectionState);
  };
}

function setConnectionSnapshot(next: RealtimeConnectionInfo): void {
  if (
    next.state === connectionSnapshot.state &&
    next.error === connectionSnapshot.error &&
    next.lastConnected === connectionSnapshot.lastConnected
  ) {
    return;
  }
  connectionSnapshot = next;
  connectionListeners.forEach((listener) => listener());
}

function clearGraceTimer(): void {
  if (graceTimer !== null) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }
}

/**
 * Re-derive the connection state from the realtime client. Called on every
 * relevant event (subscribe/unsubscribe, PB_CONNECT, disconnect).
 */
export function refreshRealtimeConnectionState(): void {
  instrumentRealtimeService();
  const { lastConnected } = connectionSnapshot;

  if (pb.realtime.isConnected) {
    clearGraceTimer();
    disconnectedSince = null;
    dropped = false;
    subscribeFailed = false;
    const stillConnected =
      connectionSnapshot.state === ConnectionState.Connected && lastConnected !== undefined;
    setConnectionSnapshot({
      state: ConnectionState.Connected,
      lastConnected: stillConnected ? lastConnected : new Date(),
    });
    return;
  }

  if (activeSubscriptions === 0) {
    // Idle: nothing subscribed, so no connection is expected
    clearGraceTimer();
    disconnectedSince = null;
    dropped = false;
    return;
  }

  const now = Date.now();
  disconnectedSince ??= now;
  const elapsed = now - disconnectedSince;

  if (subscribeFailed || elapsed >= OUTAGE_GRACE_MS) {
    clearGraceTimer();
    setConnectionSnapshot({ state: ConnectionState.Error, error: OUTAGE_MESSAGE, lastConnected });
    return;
  }

  if (dropped) {
    setConnectionSnapshot({ state: ConnectionState.Connecting, lastConnected });
  }
  // (Otherwise a connection is still being opened: no news yet.)

  if (graceTimer === null) {
    graceTimer = setTimeout(() => {
      graceTimer = null;
      refreshRealtimeConnectionState();
    }, OUTAGE_GRACE_MS - elapsed);
  }
}

/**
 * Register one active app subscription. Returns its release function.
 */
export function trackRealtimeSubscription(): () => void {
  activeSubscriptions += 1;
  refreshRealtimeConnectionState();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeSubscriptions -= 1;
    refreshRealtimeConnectionState();
  };
}

/**
 * Report a failed subscribe() (e.g. the server was unreachable when the
 * first connection was opened, which the SDK does not retry).
 */
export function reportRealtimeSubscribeError(): void {
  subscribeFailed = true;
  refreshRealtimeConnectionState();
}

/**
 * Ask every useRealtimeSubscription to drop and re-create its subscription.
 * Subscribing makes the SDK open a connection if it has none (it does not
 * retry a failed first connect on its own; a dropped one it keeps retrying),
 * and pages refetch through their onResubscribe callbacks.
 */
export function requestRealtimeReconnect(): void {
  subscribeFailed = false;
  dropped = true;
  disconnectedSince = null;
  clearGraceTimer();
  setConnectionSnapshot({
    state: ConnectionState.Connecting,
    lastConnected: connectionSnapshot.lastConnected,
  });
  reconnectGeneration += 1;
  reconnectListeners.forEach((listener) => listener());
}

/** useSyncExternalStore: current connection info */
export function getRealtimeConnectionState(): RealtimeConnectionInfo {
  return connectionSnapshot;
}

/** useSyncExternalStore: connection info changes */
export function subscribeRealtimeConnectionState(listener: () => void): () => void {
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

/** useSyncExternalStore: counter bumped by requestRealtimeReconnect() */
export function getRealtimeReconnectGeneration(): number {
  return reconnectGeneration;
}

/** useSyncExternalStore: reconnect requests */
export function subscribeRealtimeReconnect(listener: () => void): () => void {
  reconnectListeners.add(listener);
  return () => {
    reconnectListeners.delete(listener);
  };
}
