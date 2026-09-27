/**
 * PocketBase Real-Time Subscription Hook
 * Manages real-time subscriptions to PocketBase collections
 */

'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pb } from '@/lib/pocketbase/client';
import type {
  RealtimeEvent,
  RealtimeSubscriptionOptions,
  BaseRecord
} from '@/types';
import {
  logRealtimeEvent,
  getRealtimeReconnectGeneration,
  refreshRealtimeConnectionState,
  reportRealtimeSubscribeError,
  subscribeRealtimeReconnect,
  trackRealtimeSubscription,
} from '@/lib/pocketbase/realtime';

export interface UseRealtimeSubscriptionOptions<T extends BaseRecord>
  extends RealtimeSubscriptionOptions<T> {
  /**
   * Called when events may have been missed and the subscription is live
   * again: after re-subscribing once the tab is visible again, `enabled`
   * turned back on or a manual reconnect, and after the SDK re-established
   * a dropped connection. Not called for the first subscription. Use it to
   * refetch the data the page shows.
   */
  onResubscribe?: () => void | Promise<void>;
}

/**
 * Subscribe to real-time updates for a PocketBase collection
 *
 * Automatically pauses subscriptions when the page is hidden (tab not visible)
 * to conserve resources and improve performance. Changes made while paused
 * (or while the connection was down) are not replayed; pass `onResubscribe`
 * to refetch.
 *
 * @param collection - Collection name to subscribe to
 * @param options - Subscription options and callbacks
 *
 * @example
 * ```tsx
 * useRealtimeSubscription<Customer>('customer', {
 *   onCreated: (record) => {
 *     setCustomers(prev => [record, ...prev]);
 *   },
 *   onUpdated: (record) => {
 *     setCustomers(prev => prev.map(c => c.id === record.id ? record : c));
 *   },
 *   onDeleted: (record) => {
 *     setCustomers(prev => prev.filter(c => c.id !== record.id));
 *   },
 *   onResubscribe: () => loadCustomers(), // Optional: catch up after a pause
 *   enabled: true // Optional: conditionally enable subscription
 * });
 * ```
 */
export function useRealtimeSubscription<T extends BaseRecord>(
  collection: string,
  options: UseRealtimeSubscriptionOptions<T> = {}
): void {
  const {
    onCreated,
    onUpdated,
    onDeleted,
    onResubscribe,
    filter,
    enabled = true
  } = options;

  // Bumped by a manual reconnect (useRealtimeConnection().reconnect)
  const reconnectGeneration = useSyncExternalStore(
    subscribeRealtimeReconnect,
    getRealtimeReconnectGeneration,
    () => 0
  );

  // Track page visibility to pause subscriptions when hidden
  const [isPageVisible, setIsPageVisible] = useState(() => {
    if (typeof document !== 'undefined') {
      return !document.hidden;
    }
    return true;
  });

  // Use refs to avoid re-subscribing when callbacks change
  const onCreatedRef = useRef(onCreated);
  const onUpdatedRef = useRef(onUpdated);
  const onDeletedRef = useRef(onDeleted);
  const onResubscribeRef = useRef(onResubscribe);

  // collection+filter of the last subscription attempt that settled, to tell
  // a re-subscription (events may have been missed) from a first/new one
  const lastSubscribedKeyRef = useRef<string | null>(null);

  // Update refs when callbacks change
  useEffect(() => {
    onCreatedRef.current = onCreated;
    onUpdatedRef.current = onUpdated;
    onDeletedRef.current = onDeleted;
    onResubscribeRef.current = onResubscribe;
  }, [onCreated, onUpdated, onDeleted, onResubscribe]);

  // Listen for page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Realtime] Page visibility: ${!document.hidden ? 'visible' : 'hidden'}`);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    // Don't subscribe if disabled, not authenticated, or page is hidden
    if (!enabled) {
      return;
    }

    if (!pb.authStore.isValid) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Realtime] Cannot subscribe to ${collection} - not authenticated`);
      }
      return;
    }

    if (!isPageVisible) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Realtime] Pausing ${collection} subscription - page hidden`);
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Realtime] Subscribing to ${collection}`);
    }

    // Subscribe to all records in the collection
    const topic = filter ? undefined : '*';

    // `cancelled` guards against StrictMode's mount→unmount→mount double-fire:
    // the first effect's cleanup runs while its subscribe() promise is still
    // resolving, and without this guard the new mount's subscribe can race
    // with the old mount's unsubscribe — leaving orphan listeners that fire
    // events on a stale closure. Events received after cancellation are
    // dropped; the unsubscribe resolves independently and gets called either
    // way in the cleanup below.
    let cancelled = false;
    // True once this run's subscribe() resolved (the subscription is live)
    let live = false;
    const key = `${collection}\u0000${filter ?? ''}`;

    const runOnResubscribe = () => {
      const handleError = (err: unknown) =>
        console.error(`[Realtime] onResubscribe for ${collection} failed:`, err);
      try {
        Promise.resolve(onResubscribeRef.current?.()).catch(handleError);
      } catch (err) {
        handleError(err);
      }
    };

    const releaseTracking = trackRealtimeSubscription();

    const unsubscribe = pb.collection(collection).subscribe(
      topic || '*',
      async (event) => {
        if (cancelled) return;

        // Log event in development only
        logRealtimeEvent(event as RealtimeEvent<T>, collection);

        // Route to appropriate callback based on action
        const action = event.action;

        if (action === 'create' && onCreatedRef.current) {
          await onCreatedRef.current(event.record as T);
        } else if (action === 'update' && onUpdatedRef.current) {
          await onUpdatedRef.current(event.record as T);
        } else if (action === 'delete' && onDeletedRef.current) {
          await onDeletedRef.current(event.record as T);
        } else if (process.env.NODE_ENV === 'development') {
          console.warn(`[Realtime] No handler for ${action} event on ${collection}`);
        }
      },
      {
        // Apply filter if provided
        ...(filter && { filter })
      }
    );

    // PB_CONNECT fires after every (re)connect, once the SDK has re-sent the
    // subscriptions. The initial connect fires it before `subscribe` above
    // resolves, so with `live` set this is a reconnect after a drop, during
    // which events were lost.
    const unsubscribeConnect = pb.realtime.subscribe('PB_CONNECT', () => {
      if (cancelled) return;
      refreshRealtimeConnectionState();
      if (live) {
        runOnResubscribe();
      }
    });
    // Fails together with the main subscription, which reports it
    unsubscribeConnect.catch(() => {});

    unsubscribe.then(
      () => {
        if (cancelled) return;
        live = true;
        refreshRealtimeConnectionState();
        // Same collection/filter as before: this is a resume after a pause
        // (tab hidden, disabled, manual reconnect), not a new subscription
        const isResubscribe = lastSubscribedKeyRef.current === key;
        lastSubscribedKeyRef.current = key;
        if (isResubscribe) {
          runOnResubscribe();
        }
      },
      (err) => {
        // Handle subscription errors
        console.error(`[Realtime] Failed to subscribe to ${collection}:`, err);
        if (!cancelled) {
          // A later successful attempt (e.g. manual reconnect) must catch up
          lastSubscribedKeyRef.current = key;
          reportRealtimeSubscribeError();
        }
      }
    );

    // Cleanup: unsubscribe when component unmounts or dependencies change
    return () => {
      cancelled = true;
      releaseTracking();
      unsubscribe.then(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      }).catch(err => {
        console.error(`[Realtime] Error unsubscribing from ${collection}:`, err);
      });
      unsubscribeConnect.then(unsub => unsub()).catch(() => {});
    };
  }, [collection, filter, enabled, isPageVisible, reconnectGeneration]);
}
