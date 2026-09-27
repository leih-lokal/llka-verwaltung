/**
 * Update data for recording a partial return on a rental
 */

import type { Rental } from '@/types';
import { getCopyCount } from './instance-data';
import {
  getReturnedCopyCount,
  mergeReturnedItems,
  type ReturnedItemsData,
} from './partial-returns';

export interface PartialReturnUpdate {
  /** Accumulated returned copies per item */
  returned_items: ReturnedItemsData;
  /** Accumulated deposit handed back */
  deposit_back: number;
  /** Whether every copy of every item is back after this return */
  isFullyReturned: boolean;
}

/**
 * Merge newly returned copies and deposit into the rental's stored
 * returned_items / deposit_back.
 *
 * Pass the rental as freshly fetched from the server: a copy loaded when the
 * sheet opened predates any partial return made since, and merging into it
 * would drop that return. Counts are capped at the copies still out, and
 * items that are no longer part of the rental are ignored.
 */
export function buildPartialReturnUpdate(
  latest: Rental,
  newReturns: ReturnedItemsData,
  depositBack: number
): PartialReturnUpdate {
  const accepted: ReturnedItemsData = {};
  for (const [itemId, count] of Object.entries(newReturns)) {
    if (!latest.items.includes(itemId)) continue;
    const remaining =
      getCopyCount(latest.requested_copies, itemId) -
      getReturnedCopyCount(latest.returned_items, itemId);
    const accepting = Math.min(count, remaining);
    if (accepting > 0) accepted[itemId] = accepting;
  }

  const returned_items = mergeReturnedItems(latest.returned_items, accepted);
  const isFullyReturned = latest.items.every(
    (itemId) =>
      getReturnedCopyCount(returned_items, itemId) >=
      getCopyCount(latest.requested_copies, itemId)
  );

  return {
    returned_items,
    deposit_back: (latest.deposit_back || 0) + depositBack,
    isFullyReturned,
  };
}
