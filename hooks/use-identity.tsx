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
}

const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

const STORAGE_KEY_CURRENT = 'current_employee_name';
const STORAGE_KEY_HISTORY = 'employee_name_history';
const MAX_HISTORY_SIZE = 5;

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [currentIdentity, setCurrentIdentityState] = useState<string | null>(null);
  const [identityHistory, setIdentityHistory] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedCurrent = localStorage.getItem(STORAGE_KEY_CURRENT);
      const storedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);

      if (storedCurrent) {
        setCurrentIdentityState(storedCurrent);
      }

      if (storedHistory) {
        const parsed = JSON.parse(storedHistory);
        if (Array.isArray(parsed)) {
          setIdentityHistory(parsed.slice(0, MAX_HISTORY_SIZE));
        }
      }
    } catch (err) {
      console.error('Error loading identity from localStorage:', err);
    }
  }, []);

  const setIdentity = (name: string) => {
    if (!name || name.trim() === '') return;

    const trimmedName = name.trim();

    // Update current identity
    setCurrentIdentityState(trimmedName);
    localStorage.setItem(STORAGE_KEY_CURRENT, trimmedName);

    // Update history (remove duplicates, add to front, limit to MAX_HISTORY_SIZE)
    setIdentityHistory((prevHistory) => {
      const filtered = prevHistory.filter((item) => item !== trimmedName);
      const newHistory = [trimmedName, ...filtered].slice(0, MAX_HISTORY_SIZE);

      try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
      } catch (err) {
        console.error('Error saving identity history:', err);
      }

      return newHistory;
    });
  };

  const clearIdentity = () => {
    setCurrentIdentityState(null);
    localStorage.removeItem(STORAGE_KEY_CURRENT);
  };

  return (
    <IdentityContext.Provider
      value={{
        currentIdentity,
        setIdentity,
        clearIdentity,
        identityHistory,
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
