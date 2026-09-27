/**
 * Utilities for checking item copy availability across active rentals
 */

import { collections, pb } from '@/lib/pocketbase/client';
import type { Item, RentalExpanded } from '@/types';
import { getCopyCount } from './instance-data';
import { getReturnedCopyCount } from './partial-returns';

/**
 * Result of availability check for an item
 */
export interface ItemAvailability {
  /** Total number of copies this item has */
  totalCopies: number;
  /** Number of copies currently rented out */
  rentedCopies: number;
  /** Number of copies available for rent */
  availableCopies: number;
}

/**
 * Get the number of available copies for a specific item
 * Checks all active rentals and counts how many copies are currently rented
 *
 * @param itemId - The item ID to check
 * @param excludeRentalId - Optional rental ID to exclude from counting (used when editing a rental)
 * @returns ItemAvailability object with total, rented, and available copy counts
 * @throws If the item or its rentals can't be fetched
 */
export async function getItemAvailability(
  itemId: string,
  excludeRentalId?: string
): Promise<ItemAvailability> {
  try {
    // Fetch the item to get total copies
    const item = await collections.items().getOne<Item>(itemId);
    const totalCopies = item.copies || 1;

    // Fetch all rentals for this item (including partially returned ones)
    const activeRentals = await collections.rentals().getFullList<RentalExpanded>({
      filter: pb.filter('items ~ {:id}', { id: itemId }),
      expand: 'items',
    });

    // Count rented copies across all active rentals
    let rentedCopies = 0;
    for (const rental of activeRentals) {
      // Skip the rental we're editing (if specified)
      if (excludeRentalId && rental.id === excludeRentalId) {
        continue;
      }

      // Only count unreturned rentals
      if (!rental.returned_on) {
        const requestedCopies = getCopyCount(rental.requested_copies, itemId);
        const returnedCopies = getReturnedCopyCount(rental.returned_items, itemId);
        const stillOut = requestedCopies - returnedCopies;

        rentedCopies += stillOut;
      }
    }

    const availableCopies = Math.max(0, totalCopies - rentedCopies);

    return {
      totalCopies,
      rentedCopies,
      availableCopies,
    };
  } catch (error) {
    console.error('Error fetching item availability:', error);
    // Rethrow rather than reporting "0 available": callers must refuse the
    // rental (fail closed) but tell the operator that the check itself
    // failed instead of showing a misleading "0 von 0" count.
    throw error;
  }
}

/**
 * Get availability for multiple items at once
 * More efficient than calling getItemAvailability multiple times
 *
 * @param itemIds - Array of item IDs to check
 * @param excludeRentalId - Optional rental ID to exclude from counting
 * @returns Map of item IDs to their availability info
 * @throws If the items or their rentals can't be fetched
 */
export async function getMultipleItemAvailability(
  itemIds: string[],
  excludeRentalId?: string
): Promise<Map<string, ItemAvailability>> {
  const availabilityMap = new Map<string, ItemAvailability>();

  if (itemIds.length === 0) {
    return availabilityMap;
  }

  try {
    // Fetch all items at once
    const items = await collections.items().getFullList<Item>({
      filter: itemIds
        .map((id, i) => pb.filter(`id = {:id${i}}`, { [`id${i}`]: id }))
        .join(' || '),
    });

    // Create a map of item ID to total copies
    const itemCopiesMap = new Map<string, number>();
    for (const item of items) {
      itemCopiesMap.set(item.id, item.copies || 1);
    }

    // Fetch all rentals that include any of these items (including partially returned)
    const activeRentals = await collections.rentals().getFullList<RentalExpanded>({
      filter: `(${itemIds
        .map((id, i) => pb.filter(`items ~ {:id${i}}`, { [`id${i}`]: id }))
        .join(' || ')})`,
      expand: 'items',
    });

    // Initialize rented copies count for each item
    const rentedCopiesMap = new Map<string, number>();
    for (const itemId of itemIds) {
      rentedCopiesMap.set(itemId, 0);
    }

    // Count rented copies for each item
    for (const rental of activeRentals) {
      // Skip the rental we're editing (if specified)
      if (excludeRentalId && rental.id === excludeRentalId) {
        continue;
      }

      // Only count unreturned rentals
      if (!rental.returned_on) {
        for (const itemId of itemIds) {
          if (rental.items.includes(itemId)) {
            const requestedCopies = getCopyCount(rental.requested_copies, itemId);
            const returnedCopies = getReturnedCopyCount(rental.returned_items, itemId);
            const stillOut = requestedCopies - returnedCopies;

            const currentCount = rentedCopiesMap.get(itemId) || 0;
            rentedCopiesMap.set(itemId, currentCount + stillOut);
          }
        }
      }
    }

    // Build availability map. An item missing from the response (e.g.
    // deleted meanwhile) has no rentable copies.
    for (const itemId of itemIds) {
      const totalCopies = itemCopiesMap.get(itemId) ?? 0;
      const rentedCopies = rentedCopiesMap.get(itemId) || 0;
      const availableCopies = Math.max(0, totalCopies - rentedCopies);

      availabilityMap.set(itemId, {
        totalCopies,
        rentedCopies,
        availableCopies,
      });
    }

    return availabilityMap;
  } catch (error) {
    console.error('Error fetching multiple item availability:', error);
    // Rethrow (see getItemAvailability): callers refuse the rental and
    // report that availability couldn't be checked.
    throw error;
  }
}

/**
 * Check if a specific number of copies can be rented for an item
 *
 * @param itemId - The item ID to check
 * @param requestedCopies - Number of copies requested
 * @param excludeRentalId - Optional rental ID to exclude from counting
 * @returns True if the requested number of copies is available
 * @throws If availability can't be fetched
 */
export async function canRentCopies(
  itemId: string,
  requestedCopies: number,
  excludeRentalId?: string
): Promise<boolean> {
  const availability = await getItemAvailability(itemId, excludeRentalId);
  return requestedCopies <= availability.availableCopies;
}
