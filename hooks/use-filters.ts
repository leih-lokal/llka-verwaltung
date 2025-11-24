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
}

export function useFilters({ entity, config, persist = true }: UseFiltersOptions) {
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);

  // Storage key for this entity
  const storageKey = `filters_${entity}`;

  // Load filters from localStorage on mount
  useEffect(() => {
    if (!persist) return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const filters = JSON.parse(stored) as ActiveFilter[];
        setActiveFilters(filters);
      }
    } catch (error) {
      console.error('Failed to load filters from localStorage:', error);
    }
  }, [storageKey, persist]);

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

        // Check if search term is numeric (with possible leading zeros)
        const numericMatch = searchTerm.match(/^0*(\d+)$/);

        if (numericMatch) {
          // For numeric searches, add special handling for iid fields
          const numericValue = numericMatch[1]; // Stripped of leading zeros

          config.searchFields.forEach((field) => {
            if (field === 'iid' || field.endsWith('.iid')) {
              // For iid fields, search by numeric value
              searchConditions.push(`${field} = ${numericValue}`);
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
