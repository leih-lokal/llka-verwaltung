/**
 * Global quick find hook for 4-digit ID search
 * Keyboard shortcut: O → F
 */

'use client';

import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

interface QuickFindContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const QuickFindContext = createContext<QuickFindContextType | undefined>(undefined);

export function QuickFindProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);

  return (
    <QuickFindContext.Provider value={value}>
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
