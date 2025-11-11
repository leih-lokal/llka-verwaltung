/**
 * Utilities for checking item copy availability across active rentals
 */

import { collections } from '@/lib/pocketbase/client';
import type { Item, RentalExpanded } from '@/types';
import { getCopyCount } from './instance-data';

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
 */
export async function getItemAvailability(
  itemId: string,
  excludeRentalId?: string
): Promise<ItemAvailability> {
  try {
    // Fetch the item to get total copies
    const item = await collections.items().getOne<Item>(itemId);
    const totalCopies = item.copies || 1;

    // Fetch all active rentals for this item (not returned yet)
    const activeRentals = await collections.rentals().getFullList<RentalExpanded>({
      filter: `items ~ '${itemId}' && returned_on = ''`,
      expand: 'items',
    });

    // Count rented copies across all active rentals
    let rentedCopies = 0;
    for (const rental of activeRentals) {
      // Skip the rental we're editing (if specified)
      if (excludeRentalId && rental.id === excludeRentalId) {
        continue;
      }

      rentedCopies += getCopyCount(rental.requested_copies, itemId);
    }

    const availableCopies = Math.max(0, totalCopies - rentedCopies);

    return {
      totalCopies,
      rentedCopies,
      availableCopies,
    };
  } catch (error) {
    console.error('Error fetching item availability:', error);
    // Return conservative defaults on error
    return {
      totalCopies: 1,
      rentedCopies: 0,
      availableCopies: 1,
    };
  }
}

/**
 * Get availability for multiple items at once
 * More efficient than calling getItemAvailability multiple times
 *
 * @param itemIds - Array of item IDs to check
 * @param excludeRentalId - Optional rental ID to exclude from counting
 * @returns Map of item IDs to their availability info
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
      filter: itemIds.map(id => `id = '${id}'`).join(' || '),
    });

    // Create a map of item ID to total copies
    const itemCopiesMap = new Map<string, number>();
    for (const item of items) {
      itemCopiesMap.set(item.id, item.copies || 1);
    }

    // Fetch all active rentals that include any of these items
    const activeRentals = await collections.rentals().getFullList<RentalExpanded>({
      filter: `(${itemIds.map(id => `items ~ '${id}'`).join(' || ')}) && returned_on = ''`,
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

      for (const itemId of itemIds) {
        if (rental.items.includes(itemId)) {
          const currentCount = rentedCopiesMap.get(itemId) || 0;
          rentedCopiesMap.set(itemId, currentCount + getCopyCount(rental.requested_copies, itemId));
        }
      }
    }

    // Build availability map
    for (const itemId of itemIds) {
      const totalCopies = itemCopiesMap.get(itemId) || 1;
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
    // Return conservative defaults for all items
    for (const itemId of itemIds) {
      availabilityMap.set(itemId, {
        totalCopies: 1,
        rentedCopies: 0,
        availableCopies: 1,
      });
    }
    return availabilityMap;
  }
}

/**
 * Check if a specific number of copies can be rented for an item
 *
 * @param itemId - The item ID to check
 * @param requestedCopies - Number of copies requested
 * @param excludeRentalId - Optional rental ID to exclude from counting
 * @returns True if the requested number of copies is available
 */
export async function canRentCopies(
  itemId: string,
  requestedCopies: number,
  excludeRentalId?: string
): Promise<boolean> {
  const availability = await getItemAvailability(itemId, excludeRentalId);
  return requestedCopies <= availability.availableCopies;
}
