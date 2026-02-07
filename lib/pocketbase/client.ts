/**
 * PocketBase client singleton
 */

import PocketBase from 'pocketbase';
import type {
  Booking,
  Customer,
  Item,
  Rental,
  Reservation,
  Note,
  LogEntry,
  Settings,
} from '@/types';

/**
 * PocketBase collections
 */
export interface TypedPocketBase extends PocketBase {
  collection(idOrName: 'customer'): ReturnType<PocketBase['collection']> & {
    // Add custom methods if needed
  };
  collection(idOrName: 'item'): ReturnType<PocketBase['collection']>;
  collection(idOrName: 'rental'): ReturnType<PocketBase['collection']>;
  collection(idOrName: 'reservation'): ReturnType<PocketBase['collection']>;
  collection(idOrName: 'booking'): ReturnType<PocketBase['collection']>;
  collection(idOrName: 'note'): ReturnType<PocketBase['collection']>;
  collection(idOrName: 'log'): ReturnType<PocketBase['collection']>;
  collection(idOrName: 'settings'): ReturnType<PocketBase['collection']>;
  collection(idOrName: string): ReturnType<PocketBase['collection']>;
}

/**
 * Get PocketBase URL from localStorage, environment, or default
 */
function getPocketBaseUrl(): string {
  // Client-side: check localStorage first (user-configured)
  if (typeof window !== 'undefined') {
    const storedUrl = localStorage.getItem('pocketbase_url');
    if (storedUrl) {
      return storedUrl;
    }
    // Fall back to environment variable or default
    return process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
  }
  // Server-side: use environment variable or default
  return process.env.POCKETBASE_URL || 'http://localhost:8090';
}

/**
 * Create PocketBase client instance
 */
function createPocketBaseClient(): TypedPocketBase {
  const url = getPocketBaseUrl();
  const client = new PocketBase(url) as TypedPocketBase;

  // Enable auto cancellation for duplicate requests
  client.autoCancellation(false);

  return client;
}

// Store the client instance
let pbInstance: TypedPocketBase | null = null;

/**
 * Get or create PocketBase client instance
 * Reinitializes if URL has changed
 */
function getPocketBaseClient(): TypedPocketBase {
  const currentUrl = getPocketBaseUrl();

  // Create new instance if none exists or URL has changed
  if (!pbInstance || pbInstance.baseUrl !== currentUrl) {
    pbInstance = createPocketBaseClient();
  }

  return pbInstance;
}

/**
 * Singleton PocketBase client instance
 * Access via this export to ensure URL changes are respected
 */
export const pb = new Proxy({} as TypedPocketBase, {
  get(target, prop) {
    const client = getPocketBaseClient();
    const value = client[prop as keyof TypedPocketBase];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

/**
 * Type-safe collection accessors
 */
export const collections = {
  customers: () => pb.collection('customer'),
  customerRentals: () => pb.collection('customer_rentals'),
  items: () => pb.collection('item'),
  rentals: () => pb.collection('rental'),
  reservations: () => pb.collection('reservation'),
  bookings: () => pb.collection('booking'),
  notes: () => pb.collection('note'),
  logs: () => pb.collection('log'),
  settings: () => pb.collection('settings'),
} as const;

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return pb.authStore.isValid;
}

/**
 * Get current auth token
 */
export function getAuthToken(): string | null {
  return pb.authStore.token;
}

/**
 * Get current user
 */
export function getCurrentUser() {
  return pb.authStore.model;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (token: string, model: unknown) => void
) {
  return pb.authStore.onChange(callback);
}

/**
 * Get the current PocketBase server URL
 */
export function getServerUrl(): string {
  return getPocketBaseUrl();
}

/**
 * Set the PocketBase server URL
 * Note: This will take effect on next request, but requires page reload for full effect
 */
export function setServerUrl(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('pocketbase_url', url);
  }
}

/**
 * Export PocketBase client for direct access
 */
export default pb;
