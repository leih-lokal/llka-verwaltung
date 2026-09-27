/**
 * Filter utility functions
 */

import { addDays } from 'date-fns';
import { dateToLocalString } from '@/lib/utils/formatting';
import { pb } from '@/lib/pocketbase/client';
import type { Booking } from '@/types';

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
            const today = dateToLocalString(new Date());
            const tomorrow = dateToLocalString(addDays(new Date(), 1));

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
            fieldParts.push(pb.filter(`${filter.field} = {:v}`, { v: filter.value }));
          }
          break;

        case 'category':
          if (filter.value === '__none__') {
            fieldParts.push(`(${filter.field} = '' || ${filter.field} = null)`);
          } else {
            fieldParts.push(pb.filter(`${filter.field} = {:v}`, { v: filter.value }));
          }
          break;

        case 'date':
          if (Array.isArray(filter.value)) {
            const [start, end] = filter.value;
            fieldParts.push(
              pb.filter(`${filter.field} >= {:start} && ${filter.field} <= {:end}`, {
                start: `${start} 00:00:00`,
                end: `${end} 23:59:59`,
              })
            );
          }
          break;

        case 'numeric':
          if (Array.isArray(filter.value)) {
            const [min, max] = filter.value;
            fieldParts.push(
              pb.filter(`${filter.field} >= {:min} && ${filter.field} <= {:max}`, { min, max })
            );
          } else if (filter.operator) {
            // operator is restricted to a small set (see excluded-inversion below); safe to inline.
            fieldParts.push(pb.filter(`${filter.field} ${filter.operator} {:v}`, { v: filter.value }));
          }
          break;

        case 'text':
          fieldParts.push(pb.filter(`${filter.field} ~ {:v}`, { v: filter.value }));
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
          const today = dateToLocalString(new Date());
          const tomorrow = dateToLocalString(addDays(new Date(), 1));

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
          filterParts.push(pb.filter(`${filter.field} != {:v}`, { v: filter.value }));
        }
        break;

      case 'category':
        if (filter.value === '__none__') {
          // Exclude items WITHOUT category = must HAVE a category
          filterParts.push(`(${filter.field} != '' && ${filter.field} != null)`);
        } else {
          filterParts.push(pb.filter(`${filter.field} != {:v}`, { v: filter.value }));
        }
        break;

      case 'date':
        if (Array.isArray(filter.value)) {
          const [start, end] = filter.value;
          // Parenthesised: parts are joined with && which binds tighter than ||
          filterParts.push(
            `(${pb.filter(`${filter.field} < {:start} || ${filter.field} > {:end}`, {
              start: `${start} 00:00:00`,
              end: `${end} 23:59:59`,
            })})`
          );
        }
        break;

      case 'numeric':
        if (Array.isArray(filter.value)) {
          const [min, max] = filter.value;
          filterParts.push(
            `(${pb.filter(`${filter.field} < {:min} || ${filter.field} > {:max}`, { min, max })})`
          );
        } else if (filter.operator) {
          const invertedOp = filter.operator === '=' ? '!=' :
                           filter.operator === '!=' ? '=' :
                           filter.operator === '>' ? '<=' :
                           filter.operator === '<' ? '>=' :
                           filter.operator === '>=' ? '<' :
                           filter.operator === '<=' ? '>' :
                           filter.operator;
          filterParts.push(pb.filter(`${filter.field} ${invertedOp} {:v}`, { v: filter.value }));
        }
        break;

      case 'text':
        filterParts.push(pb.filter(`${filter.field} !~ {:v}`, { v: filter.value }));
        break;
    }
  });

  return filterParts.join(' && ');
}

/**
 * Build the filter for the customer search boxes (rental/reservation sheets,
 * booking dialogs, sequential mode):
 * - digits only → exact iid match
 * - "First Last" → firstname/lastname in both orders
 * - otherwise (and additionally for full names) → firstname or lastname contains the term
 *
 * Each value gets its own single-key pb.filter() call: with several keys in one
 * call, a value like "{:last}" is substituted by the next key and escapes its quotes.
 */
export function buildCustomerSearchFilter(term: string): string {
  if (/^\d+$/.test(term)) {
    return pb.filter('iid = {:iid}', { iid: parseInt(term, 10) });
  }

  const contains = (field: string, value: string) =>
    pb.filter(`${field} ~ {:v}`, { v: value });

  const trimmed = term.trim();
  const filters: string[] = [];

  if (trimmed.includes(' ')) {
    const parts = trimmed.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    filters.push(`(${contains('firstname', firstName)} && ${contains('lastname', lastName)})`);
    // Also try reversed (lastname firstname)
    filters.push(`(${contains('firstname', lastName)} && ${contains('lastname', firstName)})`);
  }

  filters.push(contains('firstname', trimmed));
  filters.push(contains('lastname', trimmed));

  return filters.join(' || ');
}

/**
 * Filter for all booking records of one logical booking (same item + customer
 * name + dates). Its result drives a bulk delete, so every value is
 * parameterised separately and a crafted customer_name can't widen the match.
 */
export function buildBookingSiblingFilter(
  booking: Pick<Booking, 'item' | 'customer_name' | 'start_date' | 'end_date'>
): string {
  return [
    pb.filter('item = {:v}', { v: booking.item }),
    pb.filter('customer_name = {:v}', { v: booking.customer_name }),
    pb.filter('start_date = {:v}', { v: booking.start_date }),
    pb.filter('end_date = {:v}', { v: booking.end_date }),
  ].join(' && ');
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
