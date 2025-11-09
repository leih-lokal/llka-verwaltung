/**
 * Global quick find hook for Cmd+P 4-digit ID search
 */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface QuickFindContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const QuickFindContext = createContext<QuickFindContextType | undefined>(undefined);

export function QuickFindProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Cmd+P or Ctrl+P
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      // Also support Cmd+Shift+F or Ctrl+Shift+F
      if (e.key === 'f' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <QuickFindContext.Provider value={{ open, setOpen }}>
      {children}
    </QuickFindContext.Provider>
  );
}

export function useQuickFind() {
  const context = useContext(QuickFindContext);
  if (context === undefined) {
    throw new Error('useQuickFind must be used within a QuickFindProvider');
  }
  return context;
}
