/**
 * Opens a table row's record from the keyboard and for screen readers.
 * List rows stay clickable for the mouse; this button sits in the row's
 * primary cell (ID or name), looks like the surrounding text and carries a
 * German label such as "Ausleihe von Max Muster öffnen".
 */

'use client';

import { cn } from '@/lib/utils';

export interface RowOpenButtonProps {
  /** Accessible name; should contain the visible text */
  label: string;

  /** Opens the record (same action as clicking the row) */
  onOpen: () => void;

  children: React.ReactNode;

  className?: string;
}

export function RowOpenButton({ label, onOpen, children, className }: RowOpenButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        // The row's own click handler would open the record a second time
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        'cursor-pointer rounded-sm text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className
      )}
    >
      {children}
    </button>
  );
}
