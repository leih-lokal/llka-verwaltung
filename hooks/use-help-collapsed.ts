/**
 * Hook for managing help panel collapsed state with localStorage persistence and TTL
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'help_panel_collapsed';
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

interface StoredState {
  isCollapsed: boolean;
  timestamp: number;
}

function getStoredState(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return true; // Default to collapsed

    const parsed: StoredState = JSON.parse(stored);
    const now = Date.now();

    // Check if TTL has expired
    if (now - parsed.timestamp > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return true; // Default to collapsed after expiry
    }

    return parsed.isCollapsed;
  } catch {
    return true; // Default to collapsed on error
  }
}

function setStoredState(isCollapsed: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    const state: StoredState = {
      isCollapsed,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore localStorage errors
  }
}

export function useHelpCollapsed() {
  const [isCollapsed, setIsCollapsedState] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setIsCollapsedState(getStoredState());
    setIsHydrated(true);
  }, []);

  const setIsCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed);
    setStoredState(collapsed);
  }, []);

  const toggle = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed, setIsCollapsed]);

  return {
    isCollapsed,
    setIsCollapsed,
    toggle,
    isHydrated,
  };
}
