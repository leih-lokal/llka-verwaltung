/**
 * Column visibility selector component
 */

'use client';

import { Columns } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ColumnConfig } from '@/lib/tables/column-configs';

export interface ColumnSelectorProps {
  /** Available columns */
  columns: ColumnConfig[];

  /** Currently visible column IDs */
  visibleColumns: string[];

  /** Callback when column visibility is toggled */
  onToggle: (columnId: string) => void;

  /** Callback to reset to defaults */
  onReset: () => void;

  /** Number of hidden columns */
  hiddenCount?: number;
}

export function ColumnSelector({
  columns,
  visibleColumns,
  onToggle,
  onReset,
  hiddenCount = 0,
}: ColumnSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 gap-1.5">
          <Columns className="h-4 w-4" />
          <span>Spalten</span>
          {hiddenCount > 0 && (
            <span className="ml-1 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
              -{hiddenCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Spalten anpassen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => {
          const isVisible = visibleColumns.includes(column.id);
          const isLastVisible = visibleColumns.length === 1 && isVisible;

          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={isVisible}
              onCheckedChange={() => onToggle(column.id)}
              disabled={isLastVisible}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem onClick={onReset}>
          Zurücksetzen
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
