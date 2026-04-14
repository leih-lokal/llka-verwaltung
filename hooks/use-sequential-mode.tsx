/**
 * Sequential Mode Hook
 * Context and state management for the keyboard-driven rental flow
 * Keyboard shortcut: O → O
 */

'use client';

import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react';
import type { Customer, Item } from '@/types';

export type SequentialModeStep = 1 | 2 | 3 | 4;

interface SelectedItem {
  item: Item;
  quantity: number;
}

interface SequentialModeContextValue {
  // Modal state
  open: boolean;
  setOpen: (open: boolean) => void;

  // Step navigation
  step: SequentialModeStep;
  setStep: (step: SequentialModeStep) => void;
  goBack: () => void;
  goNext: () => void;
  reset: () => void;

  // Data state
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;

  selectedItems: SelectedItem[];
  addItem: (item: Item, quantity: number) => void;
  removeItem: (itemId: string) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;

  expectedDate: Date;
  setExpectedDate: (date: Date) => void;

  employee: string;
  setEmployee: (employee: string) => void;

  // Computed values
  totalDeposit: number;
}

const SequentialModeContext = createContext<SequentialModeContextValue | null>(null);

export function SequentialModeProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [step, setStep] = useState<SequentialModeStep>(1);

  // Data state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [expectedDate, setExpectedDate] = useState<Date>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default: 1 week from now
  );
  const [employee, setEmployee] = useState('');

  // Reset all state when modal closes
  const reset = useCallback(() => {
    setStep(1);
    setSelectedCustomer(null);
    setSelectedItems([]);
    setExpectedDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setEmployee('');
  }, []);

  // Controlled setOpen that resets on close
  const setOpen = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      reset();
    }
    setOpenState(newOpen);
  }, [reset]);

  // Step navigation
  const goBack = useCallback(() => {
    if (step > 1) {
      setStep((step - 1) as SequentialModeStep);
    }
  }, [step]);

  const goNext = useCallback(() => {
    if (step < 4) {
      setStep((step + 1) as SequentialModeStep);
    }
  }, [step]);

  // Item management
  const addItem = useCallback((item: Item, quantity: number) => {
    setSelectedItems((items) => {
      // Check if item already exists
      const existingIndex = items.findIndex((i) => i.item.id === item.id);
      if (existingIndex >= 0) {
        // Update quantity
        const newItems = [...items];
        newItems[existingIndex] = { ...newItems[existingIndex], quantity };
        return newItems;
      }
      // Add new item
      return [...items, { item, quantity }];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setSelectedItems((items) => items.filter((i) => i.item.id !== itemId));
  }, []);

  const updateItemQuantity = useCallback((itemId: string, quantity: number) => {
    setSelectedItems((items) =>
      items.map((i) => (i.item.id === itemId ? { ...i, quantity } : i))
    );
  }, []);

  // Computed values
  const totalDeposit = useMemo(
    () =>
      selectedItems.reduce(
        (sum, { item, quantity }) => sum + (item.deposit || 0) * quantity,
        0
      ),
    [selectedItems]
  );

  const value = useMemo<SequentialModeContextValue>(
    () => ({
      open,
      setOpen,
      step,
      setStep,
      goBack,
      goNext,
      reset,
      selectedCustomer,
      setSelectedCustomer,
      selectedItems,
      addItem,
      removeItem,
      updateItemQuantity,
      expectedDate,
      setExpectedDate,
      employee,
      setEmployee,
      totalDeposit,
    }),
    [
      open,
      setOpen,
      step,
      goBack,
      goNext,
      reset,
      selectedCustomer,
      selectedItems,
      addItem,
      removeItem,
      updateItemQuantity,
      expectedDate,
      employee,
      totalDeposit,
    ]
  );

  return (
    <SequentialModeContext.Provider value={value}>
      {children}
    </SequentialModeContext.Provider>
  );
}

export function useSequentialMode() {
  const context = useContext(SequentialModeContext);
  if (!context) {
    throw new Error('useSequentialMode must be used within SequentialModeProvider');
  }
  return context;
}
