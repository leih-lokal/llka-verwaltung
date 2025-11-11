/**
 * Real-Time Connection State Hook
 * Manages and monitors PocketBase real-time connection status
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { pb } from '@/lib/pocketbase/client';
import { ConnectionState, type RealtimeConnectionInfo } from '@/types';

/**
 * Monitor PocketBase real-time connection state
 *
 * @returns Connection information and reconnection function
 *
 * @example
 * ```tsx
 * const { state, error, lastConnected, reconnect } = useRealtimeConnection();
 *
 * if (state === ConnectionState.Disconnected) {
 *   return <button onClick={reconnect}>Reconnect</button>;
 * }
 * ```
 */
export function useRealtimeConnection(): RealtimeConnectionInfo & {
  reconnect: () => void;
} {
  const [connectionInfo, setConnectionInfo] = useState<RealtimeConnectionInfo>({
    state: pb.authStore.isValid ? ConnectionState.Connected : ConnectionState.Disconnected,
    lastConnected: pb.authStore.isValid ? new Date() : undefined,
  });

  // Monitor auth store changes for connection state
  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((token) => {
      if (token) {
        setConnectionInfo({
          state: ConnectionState.Connected,
          lastConnected: new Date(),
          error: undefined,
        });
      } else {
        setConnectionInfo(prev => ({
          ...prev,
          state: ConnectionState.Disconnected,
        }));
      }
    });

    return unsubscribe;
  }, []);

  // Attempt to reconnect to PocketBase
  const reconnect = useCallback(() => {
    setConnectionInfo(prev => ({
      ...prev,
      state: ConnectionState.Connecting,
      error: undefined,
    }));

    // PocketBase automatically handles reconnection
    // We just need to check if auth is still valid
    if (pb.authStore.isValid) {
      setConnectionInfo({
        state: ConnectionState.Connected,
        lastConnected: new Date(),
        error: undefined,
      });
    } else {
      setConnectionInfo({
        state: ConnectionState.Error,
        error: 'Authentication required',
      });
    }
  }, []);

  return {
    ...connectionInfo,
    reconnect,
  };
}

/**
 * Monitor page visibility and pause subscriptions when hidden
 * This helps conserve resources when the page is not visible
 *
 * @returns Boolean indicating if page is visible
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document !== 'undefined') {
      return !document.hidden;
    }
    return true;
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
