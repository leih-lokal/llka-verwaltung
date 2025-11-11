/**
 * PocketBase Real-Time Subscription Hook
 * Manages real-time subscriptions to PocketBase collections
 */

'use client';

import { useEffect, useRef } from 'react';
import { pb } from '@/lib/pocketbase/client';
import type {
  RealtimeEvent,
  RealtimeSubscriptionOptions,
  BaseRecord
} from '@/types';
import { logRealtimeEvent, isCreateEvent, isUpdateEvent, isDeleteEvent } from '@/lib/pocketbase/realtime';

/**
 * Subscribe to real-time updates for a PocketBase collection
 *
 * @param collection - Collection name to subscribe to
 * @param options - Subscription options and callbacks
 *
 * @example
 * ```tsx
 * useRealtimeSubscription<Customer>('customers', {
 *   onCreated: (record) => {
 *     setCustomers(prev => [record, ...prev]);
 *   },
 *   onUpdated: (record) => {
 *     setCustomers(prev => prev.map(c => c.id === record.id ? record : c));
 *   },
 *   onDeleted: (record) => {
 *     setCustomers(prev => prev.filter(c => c.id !== record.id));
 *   },
 *   enabled: true // Optional: conditionally enable subscription
 * });
 * ```
 */
export function useRealtimeSubscription<T extends BaseRecord>(
  collection: string,
  options: RealtimeSubscriptionOptions<T> = {}
): void {
  const {
    onCreated,
    onUpdated,
    onDeleted,
    filter,
    enabled = true
  } = options;

  // Use refs to avoid re-subscribing when callbacks change
  const onCreatedRef = useRef(onCreated);
  const onUpdatedRef = useRef(onUpdated);
  const onDeletedRef = useRef(onDeleted);

  // Update refs when callbacks change
  useEffect(() => {
    onCreatedRef.current = onCreated;
    onUpdatedRef.current = onUpdated;
    onDeletedRef.current = onDeleted;
  }, [onCreated, onUpdated, onDeleted]);

  useEffect(() => {
    // Don't subscribe if disabled or not authenticated
    if (!enabled) {
      console.log(`[Realtime] Subscription to ${collection} disabled`);
      return;
    }

    if (!pb.authStore.isValid) {
      console.warn(`[Realtime] Cannot subscribe to ${collection} - not authenticated`);
      return;
    }

    console.log(`[Realtime] Setting up subscription to collection: ${collection}`, {
      filter,
      hasOnCreated: !!onCreatedRef.current,
      hasOnUpdated: !!onUpdatedRef.current,
      hasOnDeleted: !!onDeletedRef.current,
    });

    // Subscribe to all records in the collection
    const topic = filter ? undefined : '*';

    const unsubscribe = pb.collection(collection).subscribe(
      topic || '*',
      async (event: RealtimeEvent<T>) => {
        // Log event in development
        console.log(`[Realtime] Event received:`, {
          collection,
          action: event.action,
          recordId: event.record.id,
          record: event.record,
        });
        logRealtimeEvent(event, collection);

        // Route to appropriate callback
        if (isCreateEvent(event) && onCreatedRef.current) {
          console.log(`[Realtime] Calling onCreated for ${collection}`);
          await onCreatedRef.current(event.record);
        } else if (isUpdateEvent(event) && onUpdatedRef.current) {
          console.log(`[Realtime] Calling onUpdated for ${collection}`);
          await onUpdatedRef.current(event.record);
        } else if (isDeleteEvent(event) && onDeletedRef.current) {
          console.log(`[Realtime] Calling onDeleted for ${collection}`);
          await onDeletedRef.current(event.record);
        } else {
          console.warn(`[Realtime] No handler for ${event.action} event on ${collection}`);
        }
      },
      {
        // Apply filter if provided
        ...(filter && { filter })
      }
    );

    console.log(`[Realtime] Subscription promise created for ${collection}`);

    // Verify subscription was successful
    unsubscribe
      .then(() => {
        console.log(`[Realtime] Successfully subscribed to ${collection}`);
      })
      .catch((err) => {
        console.error(`[Realtime] Failed to subscribe to ${collection}:`, err);
      });

    // Cleanup: unsubscribe when component unmounts or dependencies change
    return () => {
      console.log(`[Realtime] Cleaning up subscription to ${collection}`);
      unsubscribe.then(unsub => {
        if (typeof unsub === 'function') {
          console.log(`[Realtime] Unsubscribing from ${collection}`);
          unsub();
        }
      }).catch(err => {
        console.error(`[Realtime] Error unsubscribing from ${collection}:`, err);
      });
    };
  }, [collection, filter, enabled]);
}

/**
 * Subscribe to real-time updates for a specific record
 *
 * @param collection - Collection name
 * @param recordId - Specific record ID to subscribe to
 * @param options - Subscription options and callbacks
 *
 * @example
 * ```tsx
 * useRealtimeRecord<Customer>('customers', customerId, {
 *   onUpdated: (record) => {
 *     setCustomer(record);
 *   },
 *   onDeleted: () => {
 *     router.push('/customers');
 *   }
 * });
 * ```
 */
export function useRealtimeRecord<T extends BaseRecord>(
  collection: string,
  recordId: string | undefined,
  options: RealtimeSubscriptionOptions<T> = {}
): void {
  const {
    onCreated,
    onUpdated,
    onDeleted,
    enabled = true
  } = options;

  const onCreatedRef = useRef(onCreated);
  const onUpdatedRef = useRef(onUpdated);
  const onDeletedRef = useRef(onDeleted);

  useEffect(() => {
    onCreatedRef.current = onCreated;
    onUpdatedRef.current = onUpdated;
    onDeletedRef.current = onDeleted;
  }, [onCreated, onUpdated, onDeleted]);

  useEffect(() => {
    // Don't subscribe if disabled, not authenticated, or no recordId
    if (!enabled || !pb.authStore.isValid || !recordId) {
      return;
    }

    // Subscribe to specific record
    const unsubscribe = pb.collection(collection).subscribe(
      recordId,
      async (event: RealtimeEvent<T>) => {
        logRealtimeEvent(event, collection);

        if (isCreateEvent(event) && onCreatedRef.current) {
          await onCreatedRef.current(event.record);
        } else if (isUpdateEvent(event) && onUpdatedRef.current) {
          await onUpdatedRef.current(event.record);
        } else if (isDeleteEvent(event) && onDeletedRef.current) {
          await onDeletedRef.current(event.record);
        }
      }
    );

    return () => {
      unsubscribe.then(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      }).catch(err => {
        console.error(`[Realtime] Error unsubscribing from ${collection}/${recordId}:`, err);
      });
    };
  }, [collection, recordId, enabled]);
}
