/**
 * PocketBase client singleton
 */

import PocketBase, { type SendOptions } from 'pocketbase';

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
  collection(idOrName: 'settings'): ReturnType<PocketBase['collection']>;
  collection(idOrName: string): ReturnType<PocketBase['collection']>;
}

/**
 * True if `url` parses and uses http: or https:. `new URL()` alone also
 * accepts javascript:, data:, file: etc.
 */
export function isValidPocketBaseUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

const SERVER_URL_STORAGE_KEY = 'pocketbase_url';

/**
 * Server URL of a login attempt in flight (see setPendingServerUrl).
 */
let pendingServerUrl: string | null = null;

/**
 * Point the client at `url` in memory only, without persisting it. Used
 * for a login attempt so the request goes to the URL the user typed, while
 * localStorage keeps the last server that actually accepted a login.
 * Pass null to go back to the stored/default URL.
 */
export function setPendingServerUrl(url: string | null): void {
  pendingServerUrl = url !== null && isValidPocketBaseUrl(url) ? url : null;
}

/**
 * Remember `url` as this browser's PocketBase server (after a successful
 * login). Returns false if it's invalid or storage is unavailable.
 */
export function persistServerUrl(url: string): boolean {
  if (!isValidPocketBaseUrl(url)) return false;
  try {
    localStorage.setItem(SERVER_URL_STORAGE_KEY, url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get PocketBase URL from a pending login attempt, localStorage,
 * environment, or default
 */
function getPocketBaseUrl(): string {
  // Client-side: check localStorage first (user-configured)
  if (typeof window !== 'undefined') {
    if (pendingServerUrl) {
      return pendingServerUrl;
    }
    const storedUrl = localStorage.getItem(SERVER_URL_STORAGE_KEY);
    if (storedUrl) {
      if (isValidPocketBaseUrl(storedUrl)) {
        return storedUrl;
      }
      // Stored before validation existed, or written by something else —
      // don't send requests (or credentials) to it.
      localStorage.removeItem(SERVER_URL_STORAGE_KEY);
    }
    // Fall back to environment variable or default
    return process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
  }
  // Server-side: use environment variable or default
  return process.env.POCKETBASE_URL || 'http://localhost:8090';
}

/**
 * Record auth endpoints (auth-with-password, auth-refresh, request-otp,
 * confirm-password-reset, impersonate, …). A 401 from these is about the
 * credentials being submitted (or, for auth-refresh, handled by
 * refreshAuth()), not a reason to drop the stored session here.
 */
const AUTH_ENDPOINT_PATTERN =
  /\/api\/collections\/[^/?#]+\/(?:auth-|request-|confirm-|impersonate\/)/;

/** The Authorization header a request was sent with, if any. */
function getSentAuthorization(headers: SendOptions['headers']): string | null {
  if (!headers) return null;
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.get('Authorization');
  }
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'authorization' && typeof value === 'string') {
      return value;
    }
  }
  return null;
}

/**
 * True if a 401 means the stored session is dead: the request carried the
 * token that is still in the store (not an older one replaced by a login
 * while the request was in flight) and wasn't an auth endpoint.
 */
export function isRevokedSessionResponse(
  client: PocketBase,
  response: Response,
  options?: SendOptions
): boolean {
  if (response.status !== 401) return false;
  const token = client.authStore.token;
  if (!token) return false;
  if (AUTH_ENDPOINT_PATTERN.test(response.url)) return false;
  return getSentAuthorization(options?.headers) === token;
}

/**
 * Create PocketBase client instance
 */
function createPocketBaseClient(): TypedPocketBase {
  const url = getPocketBaseUrl();
  const client = new PocketBase(url) as TypedPocketBase;

  // Enable auto cancellation for duplicate requests
  client.autoCancellation(false);

  // A revoked or deleted superuser used to go unnoticed until the next
  // 10-minute auth refresh. Clear the store on the first 401 instead;
  // authStore.onChange (useAuth) then routes to /login. The SDK still
  // throws the error to the caller as before.
  client.afterSend = (response: Response, data: unknown, options?: SendOptions) => {
    if (isRevokedSessionResponse(client, response, options)) {
      client.authStore.clear();
    }
    return data;
  };

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
  settings: () => pb.collection('settings'),
} as const;

/**
 * Get the current PocketBase server URL
 */
export function getServerUrl(): string {
  return getPocketBaseUrl();
}
