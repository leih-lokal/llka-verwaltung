/**
 * PocketBase Real-Time Subscription Utilities
 * Provides helper functions for managing real-time subscriptions
 */

import type { RealtimeEvent, RealtimeAction } from '@/types';

/**
 * Type guard to check if an action is a create event
 */
export function isCreateEvent<T>(event: RealtimeEvent<T>): boolean {
  return event.action === 'create';
}

/**
 * Type guard to check if an action is an update event
 */
export function isUpdateEvent<T>(event: RealtimeEvent<T>): boolean {
  return event.action === 'update';
}

/**
 * Type guard to check if an action is a delete event
 */
export function isDeleteEvent<T>(event: RealtimeEvent<T>): boolean {
  return event.action === 'delete';
}

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

/**
 * Create a debounced callback for handling rapid updates
 */
export function debounceRealtimeCallback<T>(
  callback: (record: T) => void,
  delay: number = 300
): (record: T) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (record: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      callback(record);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Batch multiple records for efficient updates
 */
export class RealtimeBatcher<T> {
  private records: Map<string, T> = new Map();
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(
    private callback: (records: T[]) => void,
    private delay: number = 500
  ) {}

  add(record: T & { id: string }): void {
    this.records.set(record.id, record);

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.flush();
    }, this.delay);
  }

  flush(): void {
    if (this.records.size > 0) {
      const recordsArray = Array.from(this.records.values());
      this.callback(recordsArray);
      this.records.clear();
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  clear(): void {
    this.records.clear();
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
