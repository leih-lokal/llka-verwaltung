/**
 * Sortable table header component
 */

'use client';

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SortDirection = 'asc' | 'desc' | null;

/**
 * aria-sort value for the header cell (<th>) of a column. Only the sorted
 * column carries the attribute.
 */
export function ariaSort(direction: SortDirection): 'ascending' | 'descending' | undefined {
  return direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined;
}

export interface SortableHeaderProps {
  /** Column label to display */
  label: React.ReactNode;

  /** Accessible name, required when the label is only an icon */
  ariaLabel?: string;

  /** Current sort direction for this column */
  sortDirection: SortDirection;

  /** Callback when header is clicked */
  onSort: () => void;

  /** Is sorting currently disabled (e.g., during loading) */
  disabled?: boolean;

  /** Additional className */
  className?: string;
}

export function SortableHeader({
  label,
  ariaLabel,
  sortDirection,
  onSort,
  disabled = false,
  className = '',
}: SortableHeaderProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onSort}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`-ml-3 h-8 data-[state=open]:bg-accent ${className}`}
    >
      <span className="font-bold">{label}</span>
      {sortDirection === 'asc' ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : sortDirection === 'desc' ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}
