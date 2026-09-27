/**
 * Hook for managing filter state with localStorage persistence
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ActiveFilter, DatePreset } from '@/lib/filters/filter-utils';
import {
  buildPocketBaseFilter,
  DATE_PRESET_LABELS,
  generateFilterId,
} from '@/lib/filters/filter-utils';
import type { EntityFilterConfig, FilterConfig } from '@/lib/filters/filter-configs';
import { pb } from '@/lib/pocketbase/client';

/** Types whose filters are picked from a config's options (and may change there) */
const OPTION_FILTER_TYPES: ReadonlyArray<ActiveFilter['type']> = ['status', 'category', 'boolean'];

/**
 * Bring filters persisted by older versions up to date:
 * - quick date chips ("Heute", …) were stored as fixed dates, so they kept
 *   filtering the day they were created; turn them back into presets
 * - option filters whose type changed in the config (reservations "done":
 *   status → boolean) take the config's type
 * - option filters whose option was removed (rental status "Teilweise
 *   zurück") are dropped instead of showing a chip that filters nothing
 */
function migrateStoredFilters(stored: ActiveFilter[], config: EntityFilterConfig): ActiveFilter[] {
  const optionConfigs = new Map<string, FilterConfig>();
  [config.statusFilters, config.categoryFilters].forEach((group) =>
    group?.forEach((c) => optionConfigs.set(c.field, c))
  );
  const presetByLabel = new Map(
    (Object.entries(DATE_PRESET_LABELS) as [DatePreset, string][]).map(([preset, label]) => [label, preset])
  );

  const migrated = stored.flatMap((filter) => {
    let next = filter;
    if (filter.type === 'date' && Array.isArray(filter.value)) {
      // Quick filter labels are "<field label>: <preset label>"
      const preset = presetByLabel.get(filter.label.slice(filter.label.lastIndexOf(': ') + 2));
      if (preset) next = { ...filter, value: preset };
    }
    const optionConfig = optionConfigs.get(filter.field);
    if (optionConfig && OPTION_FILTER_TYPES.includes(filter.type)) {
      if (!optionConfig.options?.some((o) => o.value === String(filter.value))) return [];
      if (optionConfig.type !== filter.type) next = { ...next, type: optionConfig.type };
    }
    return [next === filter ? filter : { ...next, id: generateFilterId(next) }];
  });

  // Several old "Heute" chips of the same field now collapse into one
  return migrated.filter((filter, index) => migrated.findIndex((f) => f.id === filter.id) === index);
}

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

/**
 * iid range condition for wildcard searches (37** → 3700–3799). Ranges keep
 * the filter short however many digits are open. On a multi-relation the two
 * bounds may be met by different related records, so small ranges are
 * enumerated exactly instead. Returns null for ranges beyond safe integers,
 * which no iid can fall into.
 */
function buildIidRangeCondition(
  field: string,
  min: number,
  max: number,
  isMultiValue: boolean
): string | null {
  if (!Number.isSafeInteger(max)) return null;
  // min/max are integers derived from matched digits — safe to inline.
  if (!isMultiValue) {
    return `(${field} >= ${min} && ${field} <= ${max})`;
  }
  if (max - min < 10) {
    const values = Array.from({ length: max - min + 1 }, (_, i) => `${field} ?= ${min + i}`);
    return `(${values.join(' || ')})`;
  }
  return `(${field} ?>= ${min} && ${field} ?<= ${max})`;
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
        return migrateStoredFilters(JSON.parse(stored) as ActiveFilter[], config);
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
      const multiValueFields = config.multiValueFields ?? [];
      let filterString = buildPocketBaseFilter(filtersToUse, searchQuery, { multiValueFields });

      // Replace __SEARCH__ placeholder with actual search fields
      if (searchQuery && searchQuery.trim()) {
        // Not lowercased: LIKE ignores ASCII case anyway and lowercasing breaks "Öztürk"
        const searchTerm = searchQuery;
        const searchConditions: string[] = [];

        // Multi-relation paths (items.name) need the any-of operators: a plain
        // `~` or `=` would require every related record to match.
        const isMultiValue = (field: string) => multiValueFields.includes(field);
        const isIidField = (field: string) => field === 'iid' || field.endsWith('.iid');
        const contains = (field: string, value: string) =>
          pb.filter(`${field} ${isMultiValue(field) ? '?~' : '~'} {:q}`, { q: value });

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
          const multiplier = Math.pow(10, wildcardMatch[2].length);
          const minValue = parseInt(prefix, 10) * multiplier;
          const maxValue = minValue + multiplier - 1;

          config.searchFields.forEach((field) => {
            if (isIidField(field)) {
              const range = buildIidRangeCondition(field, minValue, maxValue, isMultiValue(field));
              if (range) searchConditions.push(range);
            } else {
              searchConditions.push(contains(field, prefix));
            }
          });
        } else if (numericMatch) {
          // For numeric searches, add special handling for iid fields.
          const numericValue = parseInt(numericMatch[1], 10); // already regex-validated as digits

          config.searchFields.forEach((field) => {
            if (isIidField(field)) {
              const op = isMultiValue(field) ? '?=' : '=';
              searchConditions.push(`${field} ${op} ${numericValue}`);
            } else {
              searchConditions.push(contains(field, searchTerm));
            }
          });
        } else {
          // Non-numeric search: use text search for all fields.
          config.searchFields.forEach((field) => {
            searchConditions.push(contains(field, searchTerm));
          });
        }

        // Function replacement: a string replacement would expand `$&`-style patterns in
        // the (escaped) search text and re-insert the raw, unescaped placeholder.
        const searchFilter = `(${searchConditions.join(' || ')})`;
        filterString = filterString.replace(`__SEARCH__:"${searchTerm}"`, () => searchFilter);
      }

      return filterString;
    },
    [activeFilters, config.searchFields, config.multiValueFields, entity]
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
