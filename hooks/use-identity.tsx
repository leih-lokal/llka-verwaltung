/**
 * Global identity context for tracking current employee/operator
 * Used to auto-fill employee fields in rental forms
 */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface IdentityContextType {
  /** Current employee identity (shortcode) */
  currentIdentity: string | null;

  /** Set the current identity and add to history */
  setIdentity: (name: string) => void;

  /** Clear the current identity */
  clearIdentity: () => void;

  /** Recently used identities (max 5) */
  identityHistory: string[];

  /** Popover open state (for keyboard shortcut control) */
  popoverOpen: boolean;

  /** Set popover open state */
  setPopoverOpen: (open: boolean) => void;
}

const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

const STORAGE_KEY_CURRENT = 'current_employee_name';
const STORAGE_KEY_HISTORY = 'employee_name_history';
const MAX_HISTORY_SIZE = 5;
const IDENTITY_TTL = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
const EXPIRY_CHECK_INTERVAL = 60 * 1000; // 1 minute

interface IdentityWithTimestamp {
  value: string;
  timestamp: number;
}

// Load identity with expiration check
function loadIdentityFromStorage(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CURRENT);
    if (!stored) return null;

    // Try parsing as new format (with timestamp)
    try {
      const parsed: IdentityWithTimestamp = JSON.parse(stored);

      // Check if it has timestamp (new format)
      if (typeof parsed === 'object' && parsed.timestamp && parsed.value) {
        const age = Date.now() - parsed.timestamp;

        if (age < IDENTITY_TTL) {
          return parsed.value; // Still valid
        }

        // Expired - clear storage
        localStorage.removeItem(STORAGE_KEY_CURRENT);
        return null;
      }
    } catch {
      // Not JSON or invalid format - treat as old format (plain string)
      // Consider old format as expired, clear it
      localStorage.removeItem(STORAGE_KEY_CURRENT);
      return null;
    }

    return null;
  } catch (err) {
    console.error('Error loading identity:', err);
    return null;
  }
}

// Save identity with timestamp
function saveIdentityToStorage(identity: string): void {
  const data: IdentityWithTimestamp = {
    value: identity,
    timestamp: Date.now()
  };
  localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(data));
}

// Load history (unchanged behavior)
function loadHistoryFromStorage(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('Error loading identity history:', err);
    return [];
  }
}

// Save history (unchanged behavior)
function saveHistoryToStorage(history: string[]): void {
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  // Both are loaded from localStorage on mount. The dashboard layout renders
  // this provider client-side only (after the auth check), so the initial
  // state never has to match server-rendered HTML.
  // Identity, with expiration check
  const [currentIdentity, setCurrentIdentityState] = useState<string | null>(
    loadIdentityFromStorage
  );
  // History: no expiration, just the list of recent names
  const [identityHistory, setIdentityHistory] = useState<string[]>(() =>
    loadHistoryFromStorage().slice(0, MAX_HISTORY_SIZE)
  );
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Re-check the expiry while the app stays open: a tab left open overnight
  // would otherwise keep yesterday's employee and auto-fill them on today's
  // rentals. Checked when the tab regains focus or becomes visible, and once
  // a minute for a window that never loses focus.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === 'hidden') return;
      setCurrentIdentityState(loadIdentityFromStorage());
    };

    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    const interval = window.setInterval(recheck, EXPIRY_CHECK_INTERVAL);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
      window.clearInterval(interval);
    };
  }, []);

  const setIdentity = (name: string) => {
    if (!name || name.trim() === '') return;

    const trimmedName = name.trim();

    // Update current identity with timestamp
    setCurrentIdentityState(trimmedName);
    saveIdentityToStorage(trimmedName);

    // Update history (remove duplicates, add to front, limit to MAX_HISTORY_SIZE)
    setIdentityHistory((prevHistory) => {
      const filtered = prevHistory.filter((item) => item !== trimmedName);
      const newHistory = [trimmedName, ...filtered].slice(0, MAX_HISTORY_SIZE);
      saveHistoryToStorage(newHistory);
      return newHistory;
    });
  };

  const clearIdentity = () => {
    setCurrentIdentityState(null);
    setIdentityHistory([]);
    localStorage.removeItem(STORAGE_KEY_CURRENT);
    localStorage.removeItem(STORAGE_KEY_HISTORY);
  };

  return (
    <IdentityContext.Provider
      value={{
        currentIdentity,
        setIdentity,
        clearIdentity,
        identityHistory,
        popoverOpen,
        setPopoverOpen,
      }}
    >
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const context = useContext(IdentityContext);
  if (context === undefined) {
    throw new Error('useIdentity must be used within an IdentityProvider');
  }
  return context;
}
