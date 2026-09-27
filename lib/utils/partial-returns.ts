/**
 * Utilities for handling partial returns in rentals
 * Provides functions to track which items/copies have been returned from multi-item rentals
 */

import type { Rental, ItemReturnStatus, RentalReturnStatus } from '@/types';
import { getCopyCount } from './instance-data';

/**
 * Map of item IDs to their returned copy counts
 */
export type ReturnedItemsData = Record<string, number>;

/**
 * Get the number of returned copies for a specific item
 * @param returnedItems - The returned_items object from a rental record
 * @param itemId - The item ID to look up
 * @returns Returned copy count (defaults to 0 if not found)
 */
export function getReturnedCopyCount(
  returnedItems: ReturnedItemsData | undefined,
  itemId: string
): number {
  return returnedItems?.[itemId] || 0;
}

/**
 * Get return status for a specific item in a rental
 * @param rental - The rental record
 * @param itemId - The item ID to check
 * @returns ItemReturnStatus with requested, returned, and remaining counts
 */
export function getItemReturnStatus(
  rental: Rental,
  itemId: string
): ItemReturnStatus {
  const requestedCopies = getCopyCount(rental.requested_copies, itemId);
  const returnedCopies = getReturnedCopyCount(rental.returned_items, itemId);
  const remainingCopies = requestedCopies - returnedCopies;

  return {
    itemId,
    requestedCopies,
    returnedCopies,
    remainingCopies,
    isFullyReturned: remainingCopies === 0,
  };
}

/**
 * Get overall return status for a rental
 * Computes statistics across all items in the rental
 * @param rental - The rental record
 * @returns RentalReturnStatus with aggregated return statistics
 */
export function getRentalReturnStatus(rental: Rental): RentalReturnStatus {
  const itemStatuses = rental.items.map((itemId) =>
    getItemReturnStatus(rental, itemId)
  );

  const totalItemsRequested = itemStatuses.reduce(
    (sum, status) => sum + status.requestedCopies,
    0
  );

  const totalItemsReturned = itemStatuses.reduce(
    (sum, status) => sum + status.returnedCopies,
    0
  );

  const allFullyReturned = itemStatuses.every((s) => s.isFullyReturned);
  const someReturned = totalItemsReturned > 0;

  return {
    isFullyReturned: allFullyReturned,
    isPartiallyReturned: someReturned && !allFullyReturned,
    hasUnreturnedItems: !allFullyReturned,
    totalItemsRequested,
    totalItemsReturned,
    itemStatuses,
  };
}

/**
 * Merge partial return data into existing returned_items
 * Used when processing a new partial return to accumulate returns
 * @param existing - Current returned_items data
 * @param newReturns - New items being returned
 * @returns Merged returned_items object with accumulated counts
 */
export function mergeReturnedItems(
  existing: ReturnedItemsData | undefined,
  newReturns: ReturnedItemsData
): ReturnedItemsData {
  const merged = { ...(existing || {}) };

  for (const [itemId, count] of Object.entries(newReturns)) {
    merged[itemId] = (merged[itemId] || 0) + count;
  }

  return merged;
}
