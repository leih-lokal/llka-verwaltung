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
  const [currentIdentity, setCurrentIdentityState] = useState<string | null>(null);
  const [identityHistory, setIdentityHistory] = useState<string[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    // Load identity with expiration check
    const storedIdentity = loadIdentityFromStorage();
    if (storedIdentity) {
      setCurrentIdentityState(storedIdentity);
    }

    // Load history (no expiration, just list of recent names)
    const storedHistory = loadHistoryFromStorage();
    if (storedHistory.length > 0) {
      setIdentityHistory(storedHistory.slice(0, MAX_HISTORY_SIZE));
    }
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
