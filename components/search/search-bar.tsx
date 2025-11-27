/**
 * Enhanced search bar with integrated filter button and inline filter chips
 */

'use client';

import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FilterChip } from './filter-chip';
import type { ActiveFilter } from '@/lib/filters/filter-utils';
import { formatFilterLabel } from '@/lib/filters/filter-utils';
import { useState, useRef, useEffect } from 'react';

export interface SearchBarProps {
  /** Current search query */
  value: string;

  /** Callback when search query changes */
  onChange: (value: string) => void;

  /** Placeholder text */
  placeholder?: string;

  /** Is search disabled */
  disabled?: boolean;

  /** Active filters */
  filters?: ActiveFilter[];

  /** Callback to remove a filter */
  onRemoveFilter?: (filterId: string) => void;

  /** Callback when filter button is clicked */
  onFilterClick?: () => void;

  /** Number of active filters (shown on button) */
  filterCount?: number;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Suchen...',
  disabled = false,
  filters = [],
  onRemoveFilter,
  onFilterClick,
  filterCount = 0,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasFocusedRef = useRef(false);

  // Show filter chips when there are active filters
  const showFilterChips = filters.length > 0;

  // Restore focus after re-renders if input was previously focused
  useEffect(() => {
    if (wasFocusedRef.current && inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus();
    }
  });

  return (
    <div className="relative w-full">
      {/* Main search input container */}
      <div
        className={`
          relative flex items-center gap-2
          border-2 rounded-md transition-all h-10
          ${
            isFocused
              ? 'border-primary ring-2 ring-primary/20'
              : 'border-input hover:border-primary/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Search icon */}
        <div className="absolute left-3 top-3 pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Filter chips (inside, before input) */}
        {showFilterChips && (
          <div className="flex flex-wrap gap-1.5 pl-9 pr-2 py-2">
            {filters.map((filter) => (
              <FilterChip
                key={filter.id}
                label={formatFilterLabel(filter)}
                type={filter.type}
                onRemove={() => onRemoveFilter?.(filter.id)}
              />
            ))}
          </div>
        )}

        {/* Input field */}
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            wasFocusedRef.current = true;
          }}
          onBlur={() => {
            setIsFocused(false);
            wasFocusedRef.current = false;
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0
            bg-transparent py-2
            ${showFilterChips ? 'pl-2' : 'pl-9'}
            pr-[75px]
          `}
        />

        {/* Filter button */}
        <Button
          variant={filterCount > 0 ? 'default' : 'ghost'}
          size="sm"
          onClick={onFilterClick}
          disabled={disabled}
          className="absolute right-1 h-7 px-2 gap-1.5"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="text-xs font-medium">Filter</span>
          {filterCount > 0 && (
            <span className="ml-0.5 text-xs font-medium">({filterCount})</span>
          )}
        </Button>
      </div>
    </div>
  );
}
