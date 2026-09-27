/**
 * Filter chip component for displaying active filters inline
 */

'use client';

import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface FilterChipProps {
  /** Filter label to display */
  label: string;

  /** Filter type for styling */
  type?: 'status' | 'date' | 'category' | 'numeric' | 'boolean' | 'text' | 'default';

  /** Callback when filter is removed */
  onRemove: () => void;
}

const chipVariants = {
  status: 'default' as const,
  date: 'secondary' as const,
  category: 'outline' as const,
  numeric: 'outline' as const,
  boolean: 'outline' as const,
  text: 'secondary' as const,
  default: 'secondary' as const,
};

export function FilterChip({ label, type = 'default', onRemove }: FilterChipProps) {
  const variant = chipVariants[type];

  return (
    <Badge variant={variant} className="pl-2 pr-1 py-1 gap-1 text-xs">
      <span>{label}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-3 w-3 p-0 hover:bg-transparent"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Filter entfernen</span>
      </Button>
    </Badge>
  );
}
