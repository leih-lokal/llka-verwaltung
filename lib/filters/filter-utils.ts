/**
 * Filter utility functions
 */

import { addDays } from 'date-fns';
import { dateToLocalString } from '@/lib/utils/formatting';
import { pb } from '@/lib/pocketbase/client';
import type { Booking } from '@/types';

export interface ActiveFilter {
  id: string;
  type: 'status' | 'date' | 'category' | 'numeric' | 'boolean' | 'text';
  field: string;
  operator: string;
  /**
   * Date filters hold either a fixed [start, end] range or a DatePreset
   * ('today', …) that is resolved to dates each time the filter is built.
   * Boolean filters hold true/false or the strings 'true'/'false'.
   */
  value: string | number | boolean | [string, string] | [number, number];
  label: string;
  exclude?: boolean; // true = excluded filter (NOT), false/undefined = included filter
}

export interface BuildFilterOptions {
  /**
   * Fields holding several values (multi-select fields, multi-relation paths).
   * See EntityFilterConfig.multiValueFields.
   */
  multiValueFields?: readonly string[];
}

/** Relative date ranges offered as quick filters */
export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'last_week';

/** Chip/button labels of the date presets */
export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Heute',
  yesterday: 'Gestern',
  this_week: 'Diese Woche',
  last_week: 'Letzte Woche',
};

export function isDatePreset(value: unknown): value is DatePreset {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DATE_PRESET_LABELS, value);
}

/**
 * Local calendar days (YYYY-MM-DD, inclusive) covered by a date preset on the
 * day of `now`. Weeks run Monday to Sunday.
 */
export function getDatePresetRange(
  preset: DatePreset,
  now: Date = new Date()
): { start: string; end: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Days since Monday (getDay() is 0 for Sunday)
  const sinceMonday = (today.getDay() + 6) % 7;

  switch (preset) {
    case 'today':
      return { start: dateToLocalString(today), end: dateToLocalString(today) };
    case 'yesterday': {
      const day = addDays(today, -1);
      return { start: dateToLocalString(day), end: dateToLocalString(day) };
    }
    case 'this_week': {
      const monday = addDays(today, -sinceMonday);
      return { start: dateToLocalString(monday), end: dateToLocalString(addDays(monday, 6)) };
    }
    case 'last_week': {
      const monday = addDays(today, -sinceMonday - 7);
      return { start: dateToLocalString(monday), end: dateToLocalString(addDays(monday, 6)) };
    }
  }
}

/** [start, end] days of a date filter: its fixed range or its resolved preset */
function resolveDateRange(value: ActiveFilter['value']): [string, string] | null {
  if (Array.isArray(value)) {
    return [String(value[0]), String(value[1])];
  }
  if (isDatePreset(value)) {
    const { start, end } = getDatePresetRange(value);
    return [start, end];
  }
  return null;
}

/**
 * `field op value` with the value parameterised in a call of its own: with
 * several keys in one pb.filter() call, a value containing "{:end}" would be
 * substituted by the next key and break out of its quotes.
 */
function compare(field: string, op: string, value: unknown): string {
  return pb.filter(`${field} ${op} {:v}`, { v: value });
}

/** Boolean filter values arrive as 'true'/'false' from the filter options */
function toBoolean(value: ActiveFilter['value']): boolean {
  return value === true || value === 'true';
}

/**
 * Convert active filters to PocketBase filter string
 */
export function buildPocketBaseFilter(
  filters: ActiveFilter[],
  searchQuery?: string,
  { multiValueFields = [] }: BuildFilterOptions = {}
): string {
  const filterParts: string[] = [];
  // On multi-valued fields plain operators must hold for ALL values; `?=` means ANY
  const isMultiValue = (field: string) => multiValueFields.includes(field);

  // Add search query if present. Not lowercased: LIKE already ignores ASCII
  // case, and lowercasing would break non-ASCII terms ("Öztürk").
  if (searchQuery && searchQuery.trim()) {
    // This will be combined with entity-specific search fields
    filterParts.push(`__SEARCH__:"${searchQuery}"`);
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
  includedByField.forEach((fieldFilters) => {
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
          if (isMultiValue(filter.field)) {
            fieldParts.push(
              filter.value === '__none__'
                ? `${filter.field}:length = 0`
                : // A bare multi-select resolves to its raw JSON text; `:each`
                  // compares element-wise and `?=` matches if any element does
                  pb.filter(`${filter.field}:each ?= {:v}`, { v: filter.value })
            );
          } else if (filter.value === '__none__') {
            fieldParts.push(`(${filter.field} = '' || ${filter.field} = null)`);
          } else {
            fieldParts.push(pb.filter(`${filter.field} = {:v}`, { v: filter.value }));
          }
          break;

        case 'boolean':
          fieldParts.push(pb.filter(`${filter.field} = {:v}`, { v: toBoolean(filter.value) }));
          break;

        case 'date': {
          const range = resolveDateRange(filter.value);
          if (range) {
            const [start, end] = range;
            fieldParts.push(
              `${compare(filter.field, '>=', `${start} 00:00:00`)} && ` +
                compare(filter.field, '<=', `${end} 23:59:59`)
            );
          }
          break;
        }

        case 'numeric':
          if (Array.isArray(filter.value)) {
            const [min, max] = filter.value;
            fieldParts.push(`${compare(filter.field, '>=', min)} && ${compare(filter.field, '<=', max)}`);
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
          filterParts.push(
            isMultiValue(filter.field)
              ? `${filter.field}:length > 0`
              : `(${filter.field} != '' && ${filter.field} != null)`
          );
        } else if (isMultiValue(filter.field)) {
          // `:each !=` must hold for every element, i.e. none equals the value
          filterParts.push(pb.filter(`${filter.field}:each != {:v}`, { v: filter.value }));
        } else {
          filterParts.push(pb.filter(`${filter.field} != {:v}`, { v: filter.value }));
        }
        break;

      case 'boolean':
        filterParts.push(pb.filter(`${filter.field} != {:v}`, { v: toBoolean(filter.value) }));
        break;

      case 'date': {
        const range = resolveDateRange(filter.value);
        if (range) {
          const [start, end] = range;
          // Parenthesised: parts are joined with && which binds tighter than ||
          filterParts.push(
            `(${compare(filter.field, '<', `${start} 00:00:00`)} || ` +
              `${compare(filter.field, '>', `${end} 23:59:59`)})`
          );
        }
        break;
      }

      case 'numeric':
        if (Array.isArray(filter.value)) {
          const [min, max] = filter.value;
          filterParts.push(`(${compare(filter.field, '<', min)} || ${compare(filter.field, '>', max)})`);
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
 * Filter for one record under a list's current search and filters. Realtime
 * handlers use it to check whether a created or updated record belongs in
 * the list, instead of inserting or keeping records the list excludes.
 */
export function buildRecordInListFilter(id: string, listFilter: string): string {
  const idFilter = pb.filter('id = {:id}', { id });
  return listFilter ? `${idFilter} && (${listFilter})` : idFilter;
}

/**
 * Generate unique filter ID
 */
export function generateFilterId(filter: Omit<ActiveFilter, 'id' | 'label'>): string {
  const excludePrefix = filter.exclude ? 'exclude-' : '';
  return `${excludePrefix}${filter.type}-${filter.field}-${String(filter.value)}`;
}
