/**
 * Merge rules for a live (realtime-updated) list of unreturned rentals
 */

import type { Rental } from '@/types';

type ListedRental = Pick<Rental, 'id' | 'returned_on' | 'expected_on'>;

/** Order by due date, like the initial `sort: 'expected_on'` fetch */
function byExpectedOn(a: ListedRental, b: ListedRental): number {
  // PocketBase datetimes sort chronologically as strings
  const x = a.expected_on || '';
  const y = b.expected_on || '';
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Apply a created or updated rental: insert it or replace the old copy, or
 * drop it once it is returned. Keeps the list ordered by expected_on.
 */
export function upsertUnreturnedRental<T extends ListedRental>(list: T[], rental: T): T[] {
  if (rental.returned_on) return removeRental(list, rental.id);
  return [...list.filter((r) => r.id !== rental.id), rental].sort(byExpectedOn);
}

/**
 * Drop a rental from the list (deleted or returned). Returns the same array
 * if it wasn't listed.
 */
export function removeRental<T extends Pick<Rental, 'id'>>(list: T[], id: string): T[] {
  const rest = list.filter((r) => r.id !== id);
  return rest.length === list.length ? list : rest;
}
