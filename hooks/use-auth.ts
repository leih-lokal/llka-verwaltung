/**
 * Authentication hook
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  login as authLogin,
  logout as authLogout,
  isAuthenticated as checkAuth,
  getCurrentUser as getUser,
  setupAutoRefresh,
} from '@/lib/pocketbase/auth';
import { pb } from '@/lib/pocketbase/client';

interface UseAuthReturn {
  /** Is user authenticated? */
  isAuthenticated: boolean;
  /** Current user */
  user: unknown | null;
  /** Is auth check in progress? */
  isLoading: boolean;
  /** Login function */
  login: (username: string, password: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  /** Logout function */
  logout: () => void;
}

/**
 * Hook for authentication state and actions
 */
export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<unknown | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    const checkAuthStatus = () => {
      const authenticated = checkAuth();
      setIsAuthenticated(authenticated);
      setUser(authenticated ? getUser() : null);
      setIsLoading(false);
    };

    checkAuthStatus();

    // Setup auto-refresh
    const cleanup = setupAutoRefresh();

    // Listen for auth changes
    const unsubscribe = pb.authStore.onChange(() => {
      checkAuthStatus();
    });

    return () => {
      cleanup();
      unsubscribe();
    };
  }, []);

  /**
   * Login function
   */
  const login = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const result = await authLogin(username, password);

    if (result.success) {
      setIsAuthenticated(true);
      setUser(getUser());
    }

    setIsLoading(false);
    return result;
  };

  /**
   * Logout function
   */
  const logout = () => {
    authLogout();
    setIsAuthenticated(false);
    setUser(null);
    router.push('/login');
  };

  return {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout,
  };
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  return { isAuthenticated, isLoading };
}
