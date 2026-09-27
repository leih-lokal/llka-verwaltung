/**
 * Centralized keyboard shortcuts hook
 * Implements Linear-style sequential shortcuts with state machine
 */

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  SHORTCUT_REGISTRY,
  type ShortcutContext,
  getShortcutsForKey,
} from '@/lib/keyboard-shortcuts/shortcut-registry';
import { KeyboardShortcutToast } from '@/components/keyboard-shortcuts/keyboard-shortcut-toast';
import { isInputFocused } from '@/lib/keyboard-shortcuts/input-detection';

type SequenceState =
  | { status: 'idle' }
  | {
      status: 'waiting';
      firstKey: string;
      timestamp: number;
      toastId: string | number;
    };

interface KeyboardShortcutsContextValue {
  // Methods for registering modal setters (called by bridge component)
  registerCommandMenu: (setter: (open: boolean) => void) => void;
  registerQuickFind: (setter: (open: boolean) => void) => void;
  registerSequentialMode: (setter: (open: boolean) => void) => void;
  registerIdentityPicker: (setter: (open: boolean) => void) => void;
}

const KeyboardShortcutsContext =
  createContext<KeyboardShortcutsContextValue | null>(null);

const SEQUENCE_TIMEOUT = 2000; // 2 seconds
const DOUBLE_SHIFT_TIMEOUT = 300; // 300ms for double Shift detection

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  // A ref, not state: nothing renders from it, and state would re-attach the
  // keydown listener on every step (whose cleanup cleared the reset timer).
  const sequenceRef = useRef<SequenceState>({ status: 'idle' });
  const lastShiftPressRef = useRef<number>(0);

  // Modal state setters (populated by bridge component)
  const commandMenuOpenRef = useRef<(open: boolean) => void>(() => {});
  const quickFindOpenRef = useRef<(open: boolean) => void>(() => {});
  const sequentialModeOpenRef = useRef<(open: boolean) => void>(() => {});
  const identityPickerOpenRef = useRef<(open: boolean) => void>(() => {});

  // Timeout reference for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Build shortcut context
  const getShortcutContext = useCallback((): ShortcutContext => {
    return {
      router,
      setCommandMenuOpen: commandMenuOpenRef.current,
      setQuickFindOpen: quickFindOpenRef.current,
      setSequentialModeOpen: sequentialModeOpenRef.current,
      setIdentityPickerOpen: identityPickerOpenRef.current,
    };
  }, [router]);

  // Reset sequence state
  const resetSequence = useCallback(() => {
    const sequenceState = sequenceRef.current;
    if (sequenceState.status === 'waiting') {
      toast.dismiss(sequenceState.toastId);
    }
    sequenceRef.current = { status: 'idle' };
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if input is focused
      if (isInputFocused()) {
        return;
      }

      // Ignore if any modifier key is pressed (except Shift for double-Shift detection)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const key = e.key.toLowerCase();
      const sequenceState = sequenceRef.current;

      // Handle Escape to cancel sequence
      if (key === 'escape' && sequenceState.status === 'waiting') {
        e.preventDefault();
        resetSequence();
        return;
      }

      // Handle double Shift (Shift → Shift)
      if (key === 'shift') {
        const now = Date.now();
        const timeSinceLastShift = now - lastShiftPressRef.current;

        if (timeSinceLastShift < DOUBLE_SHIFT_TIMEOUT) {
          e.preventDefault();
          // Open search (same as O→S)
          commandMenuOpenRef.current(true);
          lastShiftPressRef.current = 0; // Reset
        } else {
          lastShiftPressRef.current = now;
        }
        return;
      }

      // Reset shift timer if any other key is pressed
      if (lastShiftPressRef.current > 0) {
        lastShiftPressRef.current = 0;
      }

      // State machine
      if (sequenceState.status === 'idle') {
        // Check if this key starts a sequence
        const shortcuts = getShortcutsForKey(key);
        if (shortcuts.length > 0) {
          e.preventDefault();

          // Get available options for this first key
          const options = shortcuts.map((s) => ({
            key: s.sequence[1],
            description: s.description,
          }));

          // Show toast with options
          const toastId = toast(
            <KeyboardShortcutToast firstKey={key} availableOptions={options} />,
            {
              duration: SEQUENCE_TIMEOUT,
              position: 'bottom-left',
            }
          );

          // Update state
          sequenceRef.current = {
            status: 'waiting',
            firstKey: key,
            timestamp: Date.now(),
            toastId,
          };

          // Set timeout to reset
          timeoutRef.current = setTimeout(() => {
            resetSequence();
          }, SEQUENCE_TIMEOUT);
        }
      } else if (sequenceState.status === 'waiting') {
        const { firstKey, timestamp } = sequenceState;
        const elapsed = Date.now() - timestamp;

        // Check if timeout expired
        if (elapsed > SEQUENCE_TIMEOUT) {
          resetSequence();
          return;
        }

        // Look for matching shortcut
        const shortcuts = getShortcutsForKey(firstKey);
        const matchingShortcut = shortcuts.find((s) => s.sequence[1] === key);

        if (matchingShortcut) {
          e.preventDefault();

          // Dismiss toast
          toast.dismiss(sequenceState.toastId);

          // Execute handler
          try {
            matchingShortcut.handler(getShortcutContext());

            // Show success feedback (subtle)
            toast.success(matchingShortcut.description, {
              duration: 2000,
              position: 'bottom-left',
            });
          } catch (error) {
            console.error('Shortcut handler error:', error);
            toast.error('Shortcut fehlgeschlagen');
          }

          // Reset state
          sequenceRef.current = { status: 'idle' };
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        } else {
          // Invalid second key - reset
          e.preventDefault();
          toast.error(
            `Unbekannter Shortcut: ${firstKey.toUpperCase()} → ${key.toUpperCase()}`,
            {
              duration: 2000,
            }
          );
          resetSequence();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [getShortcutContext, resetSequence]);

  // Register functions only write refs, so the value never needs to change
  const value = useMemo<KeyboardShortcutsContextValue>(
    () => ({
      registerCommandMenu: (setter) => {
        commandMenuOpenRef.current = setter;
      },
      registerQuickFind: (setter) => {
        quickFindOpenRef.current = setter;
      },
      registerSequentialMode: (setter) => {
        sequentialModeOpenRef.current = setter;
      },
      registerIdentityPicker: (setter) => {
        identityPickerOpenRef.current = setter;
      },
    }),
    []
  );

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error(
      'useKeyboardShortcuts must be used within KeyboardShortcutsProvider'
    );
  }
  return context;
}
