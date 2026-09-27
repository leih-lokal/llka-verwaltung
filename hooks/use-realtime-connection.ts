/**
 * Real-Time Connection State Hook
 * Manages and monitors PocketBase real-time connection status
 */

'use client';

import { useSyncExternalStore } from 'react';
import type { RealtimeConnectionInfo } from '@/types';
import {
  getRealtimeConnectionState,
  requestRealtimeReconnect,
  subscribeRealtimeConnectionState,
} from '@/lib/pocketbase/realtime';

/**
 * Monitor PocketBase real-time connection state
 *
 * Derived from the realtime client (see lib/pocketbase/realtime.ts):
 * Connected while it is connected (or idle, with nothing subscribed),
 * Connecting while the SDK re-establishes a dropped connection, Error when
 * it stays down for a while or the first connect failed. `reconnect`
 * re-creates all useRealtimeSubscription subscriptions, which opens a new
 * connection if there is none and lets pages refetch via onResubscribe.
 *
 * @returns Connection information and reconnection function
 *
 * @example
 * ```tsx
 * const { state, error, lastConnected, reconnect } = useRealtimeConnection();
 *
 * if (state === ConnectionState.Error) {
 *   return <button onClick={reconnect}>Reconnect</button>;
 * }
 * ```
 */
export function useRealtimeConnection(): RealtimeConnectionInfo & {
  reconnect: () => void;
} {
  const connectionInfo = useSyncExternalStore(
    subscribeRealtimeConnectionState,
    getRealtimeConnectionState,
    getRealtimeConnectionState
  );

  return {
    ...connectionInfo,
    reconnect: requestRealtimeReconnect,
  };
}
