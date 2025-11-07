/**
 * Authentication utilities for PocketBase
 */

import { pb } from './client';

/**
 * Login with username and password
 */
export async function login(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Authenticate as admin
    await pb.collection('_superusers').authWithPassword(username, password);

    return { success: true };
  } catch (error) {
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
    return false;
  }
}

/**
 * Setup auto-refresh for auth token
 * Refreshes 5 minutes before expiration
 */
export function setupAutoRefresh(): () => void {
  let intervalId: NodeJS.Timeout | null = null;

  const startAutoRefresh = () => {
    // Clear existing interval
    if (intervalId) {
      clearInterval(intervalId);
    }

    // Refresh every 10 minutes (PocketBase tokens last 2 weeks by default)
    intervalId = setInterval(
      async () => {
        if (pb.authStore.isValid) {
          await refreshAuth();
        }
      },
      10 * 60 * 1000
    ); // 10 minutes
  };

  // Start immediately if authenticated
  if (pb.authStore.isValid) {
    startAutoRefresh();
  }

  // Listen for auth changes
  const unsubscribe = pb.authStore.onChange(() => {
    if (pb.authStore.isValid) {
      startAutoRefresh();
    } else if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  });

  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    unsubscribe();
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
