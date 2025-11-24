/**
 * Filter utility functions
 */

export interface ActiveFilter {
  id: string;
  type: 'status' | 'date' | 'category' | 'numeric' | 'text';
  field: string;
  operator: string;
  value: string | number | boolean | [string, string] | [number, number];
  label: string;
}

/**
 * Convert active filters to PocketBase filter string
 */
export function buildPocketBaseFilter(
  filters: ActiveFilter[],
  searchQuery?: string
): string {
  const filterParts: string[] = [];

  // Add search query if present
  if (searchQuery && searchQuery.trim()) {
    const searchTerm = searchQuery.toLowerCase();
    // This will be combined with entity-specific search fields
    filterParts.push(`__SEARCH__:"${searchTerm}"`);
  }

  // Group filters by field for OR logic on same field
  const filtersByField = new Map<string, ActiveFilter[]>();
  filters.forEach((filter) => {
    const existing = filtersByField.get(filter.field) || [];
    existing.push(filter);
    filtersByField.set(filter.field, existing);
  });

  // Build filter string for each field group
  filtersByField.forEach((fieldFilters, field) => {
    const fieldParts: string[] = [];

    fieldFilters.forEach((filter) => {
      switch (filter.type) {
        case 'status':
          // Handle computed rental status specially
          if (filter.field === '__rental_status__') {
            const today = new Date().toISOString().split('T')[0];
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            switch (filter.value) {
              case 'active':
                // Not returned and expected date is in the future (not today or past)
                fieldParts.push(`(returned_on = '' && expected_on >= '${tomorrow}')`);
                break;
              case 'overdue':
                // Not returned and expected date is in the past
                fieldParts.push(`(returned_on = '' && expected_on < '${today}')`);
                break;
              case 'due_today':
                // Not returned and expected date is today
                fieldParts.push(`(returned_on = '' && expected_on >= '${today}' && expected_on < '${tomorrow}')`);
                break;
              case 'returned':
                // Returned but not today
                fieldParts.push(`(returned_on != '' && (returned_on < '${today}' || returned_on >= '${tomorrow}'))`);
                break;
              case 'returned_today':
                // Returned today
                fieldParts.push(`(returned_on >= '${today}' && returned_on < '${tomorrow}')`);
                break;
            }
          } else {
            fieldParts.push(`${filter.field} = '${filter.value}'`);
          }
          break;

        case 'category':
          // For category fields, use equals for simple values
          // Special case: __none__ means field is empty/null
          if (filter.value === '__none__') {
            fieldParts.push(`(${filter.field} = '' || ${filter.field} = null)`);
          } else {
            fieldParts.push(`${filter.field} = '${filter.value}'`);
          }
          break;

        case 'date':
          if (Array.isArray(filter.value)) {
            const [start, end] = filter.value;
            fieldParts.push(
              `(${filter.field} >= '${start}' && ${filter.field} <= '${end}')`
            );
          }
          break;

        case 'numeric':
          if (Array.isArray(filter.value)) {
            const [min, max] = filter.value;
            fieldParts.push(
              `(${filter.field} >= ${min} && ${filter.field} <= ${max})`
            );
          } else if (filter.operator) {
            fieldParts.push(`${filter.field} ${filter.operator} ${filter.value}`);
          }
          break;

        case 'text':
          fieldParts.push(`${filter.field} ~ '${filter.value}'`);
          break;
      }
    });

    // Join multiple values for the same field with OR
    if (fieldParts.length > 0) {
      if (fieldParts.length === 1) {
        filterParts.push(fieldParts[0]);
      } else {
        filterParts.push(`(${fieldParts.join(' || ')})`);
      }
    }
  });

  return filterParts.join(' && ');
}

/**
 * Format filter label for display
 */
export function formatFilterLabel(filter: ActiveFilter): string {
  return filter.label;
}

/**
 * Generate unique filter ID
 */
export function generateFilterId(filter: Omit<ActiveFilter, 'id' | 'label'>): string {
  return `${filter.type}-${filter.field}-${String(filter.value)}`;
}
