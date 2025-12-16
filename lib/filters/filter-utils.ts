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
  exclude?: boolean; // true = excluded filter (NOT), false/undefined = included filter
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

  // Separate included and excluded filters
  const includedFilters = filters.filter(f => !f.exclude);
  const excludedFilters = filters.filter(f => f.exclude);

  console.log('[buildPocketBaseFilter] Processing filters:', {
    total: filters.length,
    included: includedFilters.length,
    excluded: excludedFilters.length,
    excludedFilters: excludedFilters.map(f => ({ field: f.field, value: f.value, exclude: f.exclude }))
  });

  // ==================== Process INCLUDED filters ====================
  // Group included filters by field for OR logic on same field
  const includedByField = new Map<string, ActiveFilter[]>();
  includedFilters.forEach((filter) => {
    const existing = includedByField.get(filter.field) || [];
    existing.push(filter);
    includedByField.set(filter.field, existing);
  });

  // Build included filter strings
  includedByField.forEach((fieldFilters, field) => {
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
                fieldParts.push(`(returned_on = '' && expected_on >= '${tomorrow}')`);
                break;
              case 'overdue':
                fieldParts.push(`(returned_on = '' && expected_on < '${today}')`);
                break;
              case 'due_today':
                fieldParts.push(`(returned_on = '' && expected_on >= '${today}' && expected_on < '${tomorrow}')`);
                break;
              case 'returned':
                fieldParts.push(`(returned_on != '' && (returned_on < '${today}' || returned_on >= '${tomorrow}'))`);
                break;
              case 'returned_today':
                fieldParts.push(`(returned_on >= '${today}' && returned_on < '${tomorrow}')`);
                break;
            }
          } else {
            fieldParts.push(`${filter.field} = '${filter.value}'`);
          }
          break;

        case 'category':
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

  // ==================== Process EXCLUDED filters ====================
  // Each excluded filter is added individually with NOT logic
  excludedFilters.forEach((filter) => {
    switch (filter.type) {
      case 'status':
        // Handle computed rental status specially
        if (filter.field === '__rental_status__') {
          const today = new Date().toISOString().split('T')[0];
          const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          // Exclude by inverting the logic
          switch (filter.value) {
            case 'active':
              // NOT active = returned OR (not returned AND expected is today or past)
              filterParts.push(`(returned_on != '' || expected_on < '${tomorrow}')`);
              break;
            case 'overdue':
              // NOT overdue = returned OR expected is today or future
              filterParts.push(`(returned_on != '' || expected_on >= '${today}')`);
              break;
            case 'due_today':
              // NOT due today = returned OR expected is not today
              filterParts.push(`(returned_on != '' || expected_on < '${today}' || expected_on >= '${tomorrow}')`);
              break;
            case 'returned':
              // NOT returned (but not today) = not returned OR returned today
              filterParts.push(`(returned_on = '' || (returned_on >= '${today}' && returned_on < '${tomorrow}'))`);
              break;
            case 'returned_today':
              // NOT returned today = not returned OR returned not today
              filterParts.push(`(returned_on = '' || returned_on < '${today}' || returned_on >= '${tomorrow}')`);
              break;
          }
        } else {
          filterParts.push(`${filter.field} != '${filter.value}'`);
        }
        break;

      case 'category':
        if (filter.value === '__none__') {
          // Exclude items WITHOUT category = must HAVE a category
          filterParts.push(`(${filter.field} != '' && ${filter.field} != null)`);
        } else {
          filterParts.push(`${filter.field} != '${filter.value}'`);
        }
        break;

      case 'date':
        if (Array.isArray(filter.value)) {
          const [start, end] = filter.value;
          // Items OUTSIDE this date range
          filterParts.push(
            `(${filter.field} < '${start}' || ${filter.field} > '${end}')`
          );
        }
        break;

      case 'numeric':
        if (Array.isArray(filter.value)) {
          const [min, max] = filter.value;
          // Items OUTSIDE this numeric range
          filterParts.push(
            `(${filter.field} < ${min} || ${filter.field} > ${max})`
          );
        } else if (filter.operator) {
          // Invert the operator
          const invertedOp = filter.operator === '=' ? '!=' :
                           filter.operator === '!=' ? '=' :
                           filter.operator === '>' ? '<=' :
                           filter.operator === '<' ? '>=' :
                           filter.operator === '>=' ? '<' :
                           filter.operator === '<=' ? '>' :
                           filter.operator;
          filterParts.push(`${filter.field} ${invertedOp} ${filter.value}`);
        }
        break;

      case 'text':
        // NOT containing text
        filterParts.push(`${filter.field} !~ '${filter.value}'`);
        break;
    }
  });

  const finalFilter = filterParts.join(' && ');
  console.log('[buildPocketBaseFilter] Final filter string:', finalFilter);
  return finalFilter;
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
  const excludePrefix = filter.exclude ? 'exclude-' : '';
  return `${excludePrefix}${filter.type}-${filter.field}-${String(filter.value)}`;
}
