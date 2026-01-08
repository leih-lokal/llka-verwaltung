/**
 * Hook for managing filter state with localStorage persistence
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ActiveFilter } from '@/lib/filters/filter-utils';
import { buildPocketBaseFilter, generateFilterId } from '@/lib/filters/filter-utils';
import type { EntityFilterConfig } from '@/lib/filters/filter-configs';

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
      console.log(`[useFilters] Initializing filters for ${entity}:`, stored ? 'Found in localStorage' : 'Not in localStorage');

      if (stored) {
        const filters = JSON.parse(stored) as ActiveFilter[];
        console.log(`[useFilters] Loaded ${filters.length} filter(s) from localStorage`);
        return filters;
      } else if (defaultFilters && defaultFilters.length > 0) {
        // No saved filters - apply defaults
        console.log(`[useFilters] Applying ${defaultFilters.length} default filter(s)`);
        const filtersWithIds = defaultFilters.map(f => ({
          ...f,
          id: generateFilterId(f),
        }));
        console.log('[useFilters] Default filters with IDs:', filtersWithIds);
        return filtersWithIds;
      } else {
        console.log('[useFilters] No filters to load (no localStorage, no defaults)');
        return [];
      }
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

        if (wildcardMatch) {
          // Wildcard IID search: e.g., 37** matches 3700-3799, 7** matches 700-799
          const prefix = wildcardMatch[1];
          const wildcardCount = wildcardMatch[2].length;
          const multiplier = Math.pow(10, wildcardCount);
          const minValue = parseInt(prefix, 10) * multiplier;
          const maxValue = minValue + multiplier - 1;

          config.searchFields.forEach((field) => {
            if (field === 'iid' || field.endsWith('.iid')) {
              // Check if this is an array field (e.g., items.iid for rentals/reservations)
              const isArrayField = field.includes('.');

              if (isArrayField) {
                // For array fields, we need to search within the array
                // PocketBase doesn't support range queries on array fields directly,
                // so we generate individual checks for each possible value in range
                // For small ranges (< 100 values), enumerate them; otherwise, use text search on prefix
                const rangeSize = maxValue - minValue + 1;
                if (rangeSize <= 100) {
                  const values = Array.from({ length: rangeSize }, (_, i) => minValue + i);
                  const conditions = values.map(v => `${field} ?= ${v}`).join(' || ');
                  searchConditions.push(`(${conditions})`);
                } else {
                  // Range too large, fall back to text search on the field name
                  const fieldParts = field.split('.');
                  const nameField = `${fieldParts[0]}.name`;
                  searchConditions.push(`${nameField} ~ "${prefix}"`);
                }
              } else {
                // For non-array iid fields, search by range
                searchConditions.push(`(${field} >= ${minValue} && ${field} <= ${maxValue})`);
              }
            } else {
              // For text fields, do text search with the prefix
              searchConditions.push(`${field} ~ "${prefix}"`);
            }
          });
        } else if (numericMatch) {
          // For numeric searches, add special handling for iid fields
          const numericValue = numericMatch[1]; // Stripped of leading zeros

          config.searchFields.forEach((field) => {
            if (field === 'iid' || field.endsWith('.iid')) {
              // Check if this is an array field (e.g., items.iid for rentals/reservations)
              const isArrayField = field.includes('.');

              if (isArrayField) {
                // For array fields, use the ?= operator to check if any element matches
                searchConditions.push(`${field} ?= ${numericValue}`);
              } else {
                // For non-array iid fields, use exact match
                searchConditions.push(`${field} = ${numericValue}`);
              }
            } else {
              // For text fields, still do text search with original term
              searchConditions.push(`${field} ~ "${searchTerm}"`);
            }
          });
        } else {
          // Non-numeric search: use text search for all fields
          config.searchFields.forEach((field) => {
            searchConditions.push(`${field} ~ "${searchTerm}"`);
          });
        }

        filterString = filterString.replace(
          `__SEARCH__:"${searchTerm}"`,
          `(${searchConditions.join(' || ')})`
        );
      }

      return filterString;
    },
    [activeFilters, config.searchFields]
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
