/**
 * Utilities for handling instanced items (items with multiple copies)
 * Instance data is stored in the rental requested_copies JSON field
 */

/**
 * Map of item IDs to their copy counts in a rental
 */
export type InstanceData = Record<string, number>;

/**
 * Get the copy count for a specific item from requested_copies
 * @param requestedCopies - The requested_copies object from a rental record
 * @param itemId - The item ID to look up
 * @returns Copy count (defaults to 1 if not found)
 */
export function getCopyCount(
  requestedCopies: InstanceData | undefined,
  itemId: string
): number {
  return requestedCopies?.[itemId] || 1;
}

/**
 * Set the copy count for a specific item in requested_copies
 * @param requestedCopies - The requested_copies object from a rental record
 * @param itemId - The item ID to update
 * @param count - The copy count to set
 * @returns New requested_copies object with updated count
 */
export function setCopyCount(
  requestedCopies: InstanceData | undefined,
  itemId: string,
  count: number
): InstanceData {
  return {
    ...(requestedCopies || {}),
    [itemId]: count,
  };
}

/**
 * Remove an item from requested_copies
 * @param requestedCopies - The requested_copies object from a rental record
 * @param itemId - The item ID to remove
 * @returns New requested_copies object without the specified item
 */
export function removeCopyCount(
  requestedCopies: InstanceData | undefined,
  itemId: string
): InstanceData {
  const newData = { ...(requestedCopies || {}) };
  delete newData[itemId];
  return newData;
}
