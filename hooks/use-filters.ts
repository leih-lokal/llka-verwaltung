/**
 * Hook for managing filter state with localStorage persistence
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ActiveFilter } from '@/lib/filters/filter-utils';
import { buildPocketBaseFilter, generateFilterId } from '@/lib/filters/filter-utils';
import type { EntityFilterConfig } from '@/lib/filters/filter-configs';
import { pb } from '@/lib/pocketbase/client';

export interface UseFiltersOptions {
  /** Entity type for localStorage key */
  entity: 'customers' | 'items' | 'rentals' | 'reservations' | 'logs';

  /** Filter configuration */
  config: EntityFilterConfig;

  /** Enable localStorage persistence */
  persist?: boolean;

  /** Default filters to apply on first load (when localStorage is empty) */
  defaultFilters?: Omit<ActiveFilter, 'id'>[];
}

export function useFilters({ entity, config, persist = true, defaultFilters }: UseFiltersOptions) {
  // Storage key for this entity
  const storageKey = `filters_${entity}`;

  // Initialize state with localStorage or default filters
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() => {
    if (!persist) return [];

    try {
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        return JSON.parse(stored) as ActiveFilter[];
      } else if (defaultFilters && defaultFilters.length > 0) {
        return defaultFilters.map(f => ({ ...f, id: generateFilterId(f) }));
      }
      return [];
    } catch (error) {
      console.error('Failed to load filters from localStorage:', error);
      return [];
    }
  });

  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);

  // Save filters to localStorage when they change
  useEffect(() => {
    if (!persist) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(activeFilters));
    } catch (error) {
      console.error('Failed to save filters to localStorage:', error);
    }
  }, [activeFilters, storageKey, persist]);

  /**
   * Add a new filter
   */
  const addFilter = useCallback((filter: Omit<ActiveFilter, 'id'>) => {
    const id = generateFilterId(filter);
    const newFilter: ActiveFilter = {
      ...filter,
      id,
    };

    setActiveFilters((prev) => {
      // Don't add duplicate filters
      if (prev.some((f) => f.id === id)) {
        return prev;
      }
      return [...prev, newFilter];
    });
  }, []);

  /**
   * Remove a filter by ID
   */
  const removeFilter = useCallback((filterId: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== filterId));
  }, []);

  /**
   * Clear all filters
   */
  const clearAllFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  /**
   * Build PocketBase filter string from active filters and search query
   */
  const buildFilter = useCallback(
    (searchQuery: string = ''): string => {
      // For rentals, convert status filters to date-based filters
      let filtersToUse = activeFilters;
      if (entity === 'rentals') {
        filtersToUse = activeFilters.map(filter => {
          if (filter.field === '__computed_status__') {
            // Convert status filter to equivalent date filters
            // This is a special filter that needs to be handled differently
            return { ...filter, field: '__rental_status__' };
          }
          return filter;
        });
      }

      // Build base filter from active filters
      let filterString = buildPocketBaseFilter(filtersToUse, searchQuery);

      // Replace __SEARCH__ placeholder with actual search fields
      if (searchQuery && searchQuery.trim()) {
        const searchTerm = searchQuery.toLowerCase();
        const searchConditions: string[] = [];

        // Check if search term is a wildcard IID pattern (e.g., 37**, 7**, 2***)
        // Each * represents a single digit position
        const wildcardMatch = searchTerm.match(/^(\d+)(\*+)$/);

        // Check if search term is numeric (with possible leading zeros)
        const numericMatch = searchTerm.match(/^0*(\d+)$/);

        // field names come from trusted config; only the value (prefix/searchTerm/numericValue)
        // is user input and must be parameterised via pb.filter.
        if (wildcardMatch) {
          // Wildcard IID search: e.g., 37** matches 3700-3799, 7** matches 700-799
          const prefix = wildcardMatch[1];
          const wildcardCount = wildcardMatch[2].length;
          const multiplier = Math.pow(10, wildcardCount);
          const minValue = parseInt(prefix, 10) * multiplier;
          const maxValue = minValue + multiplier - 1;

          config.searchFields.forEach((field) => {
            if (field === 'iid' || field.endsWith('.iid')) {
              const isArrayField = field.includes('.');

              if (isArrayField) {
                // For array fields, generate individual ?= checks for each value in range.
                const rangeSize = maxValue - minValue + 1;
                if (rangeSize <= 100) {
                  const values = Array.from({ length: rangeSize }, (_, i) => minValue + i);
                  // minValue/maxValue are numbers derived from matched digits — safe.
                  const conditions = values.map(v => `${field} ?= ${v}`).join(' || ');
                  searchConditions.push(`(${conditions})`);
                } else {
                  // Range too large, fall back to text search on the field name.
                  const fieldParts = field.split('.');
                  const nameField = `${fieldParts[0]}.name`;
                  searchConditions.push(pb.filter(`${nameField} ~ {:q}`, { q: prefix }));
                }
              } else {
                searchConditions.push(`(${field} >= ${minValue} && ${field} <= ${maxValue})`);
              }
            } else {
              searchConditions.push(pb.filter(`${field} ~ {:q}`, { q: prefix }));
            }
          });
        } else if (numericMatch) {
          // For numeric searches, add special handling for iid fields.
          const numericValue = parseInt(numericMatch[1], 10); // already regex-validated as digits

          config.searchFields.forEach((field) => {
            if (field === 'iid' || field.endsWith('.iid')) {
              const op = field.includes('.') ? '?=' : '=';
              searchConditions.push(`${field} ${op} ${numericValue}`);
            } else {
              searchConditions.push(pb.filter(`${field} ~ {:q}`, { q: searchTerm }));
            }
          });
        } else {
          // Non-numeric search: use text search for all fields.
          config.searchFields.forEach((field) => {
            searchConditions.push(pb.filter(`${field} ~ {:q}`, { q: searchTerm }));
          });
        }

        // Function replacement: a string replacement would expand `$&` / `$\`` in the
        // (escaped) search text and re-insert the raw, unescaped placeholder.
        const searchFilter = `(${searchConditions.join(' || ')})`;
        filterString = filterString.replace(`__SEARCH__:"${searchTerm}"`, () => searchFilter);
      }

      return filterString;
    },
    [activeFilters, config.searchFields, entity]
  );

  /**
   * Toggle filter popover
   */
  const toggleFilterPopover = useCallback(() => {
    setIsFilterPopoverOpen((prev) => !prev);
  }, []);

  return {
    // State
    activeFilters,
    filterCount: activeFilters.length,
    isFilterPopoverOpen,

    // Actions
    addFilter,
    removeFilter,
    clearAllFilters,
    buildFilter,
    setIsFilterPopoverOpen,
    toggleFilterPopover,
  };
}
