/**
 * Authentication utilities for PocketBase
 */

import {
  pb,
  isValidPocketBaseUrl,
  persistServerUrl,
  setPendingServerUrl,
} from './client';

/**
 * Login with username and password
 *
 * With `serverUrl`, the attempt goes to that server, but the URL is only
 * persisted (and so prefilled for the next person at a shared terminal, and
 * used to load the login page branding) once the server accepted the login.
 */
export async function login(
  username: string,
  password: string,
  serverUrl?: string
): Promise<{ success: boolean; error?: string }> {
  if (serverUrl !== undefined) {
    if (!isValidPocketBaseUrl(serverUrl)) {
      return {
        success: false,
        error: 'Bitte geben Sie eine gültige Server-URL ein (http:// oder https://)',
      };
    }
    setPendingServerUrl(serverUrl);
  }

  try {
    // Authenticate as admin
    await pb.collection('_superusers').authWithPassword(username, password);

    // Stored URL now matches, so the in-memory override can go. If storage
    // is unavailable, keep it so this session stays on the server it just
    // logged in to.
    if (serverUrl !== undefined && persistServerUrl(serverUrl)) {
      setPendingServerUrl(null);
    }

    return { success: true };
  } catch (error) {
    // Back to the previously stored (or default) server
    if (serverUrl !== undefined) {
      setPendingServerUrl(null);
    }
    console.error('Login error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Anmeldedaten.',
    };
  }
}

/**
 * Logout current user
 */
export function logout(): void {
  pb.authStore.clear();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return pb.authStore.isValid;
}

/**
 * Get current user
 */
export function getCurrentUser() {
  return pb.authStore.model;
}

/**
 * Get current auth token
 */
export function getAuthToken(): string | null {
  return pb.authStore.token;
}

/**
 * Refresh authentication
 * Call this before token expires
 */
export async function refreshAuth(): Promise<boolean> {
  try {
    if (!pb.authStore.isValid) {
      return false;
    }

    await pb.collection('_superusers').authRefresh();
    return true;
  } catch (error) {
    console.error('Auth refresh error:', error);
    // If the server explicitly rejected the token (401/403), it's revoked
    // or expired — clear the local auth state so the app routes to /login
    // instead of retrying indefinitely with a dead token.
    const status = (error as { status?: number })?.status;
    if (status === 401 || status === 403) {
      pb.authStore.clear();
    }
    return false;
  }
}

// Refresh every 10 minutes (PocketBase tokens last 2 weeks by default)
const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/** Active setupAutoRefresh() callers sharing the one interval below. */
let autoRefreshUsers = 0;
let autoRefreshIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Setup auto-refresh for auth token
 *
 * useAuth() runs in many components at once, and each used to start its
 * own interval (and refresh request). They now share a single ref-counted
 * interval; the returned cleanup releases this caller's reference and the
 * last one stops it. Validity is checked on each tick (through the pb
 * Proxy), so it follows logins/logouts and client re-creation after a
 * server URL change without subscribing to a particular authStore.
 */
export function setupAutoRefresh(): () => void {
  autoRefreshUsers += 1;

  if (autoRefreshIntervalId === null) {
    autoRefreshIntervalId = setInterval(() => {
      if (pb.authStore.isValid) {
        void refreshAuth();
      }
    }, AUTO_REFRESH_INTERVAL_MS);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    autoRefreshUsers -= 1;
    if (autoRefreshUsers === 0 && autoRefreshIntervalId !== null) {
      clearInterval(autoRefreshIntervalId);
      autoRefreshIntervalId = null;
    }
  };
}

/**
 * Initialize auth from stored credentials
 * Call this on app startup
 */
export function initAuth(): void {
  // PocketBase automatically loads auth from localStorage
  // Just verify it's still valid
  if (pb.authStore.isValid) {
    // Optionally refresh to ensure token is fresh
    refreshAuth().catch(() => {
      // If refresh fails, clear auth
      pb.authStore.clear();
    });
  }
}
