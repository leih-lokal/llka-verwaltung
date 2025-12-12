/**
 * Status constants and utilities
 */

import { ItemStatus, RentalStatus } from '@/types';

/**
 * Item status labels (German)
 */
export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  [ItemStatus.InStock]: 'Verfügbar',
  [ItemStatus.OutOfStock]: 'Verliehen',
  [ItemStatus.Reserved]: 'Reserviert',
  [ItemStatus.OnBackorder]: 'Bestellt',
  [ItemStatus.Lost]: 'Verloren',
  [ItemStatus.Repairing]: 'In Reparatur',
  [ItemStatus.ForSale]: 'Zu verkaufen',
  [ItemStatus.Deleted]: 'Gelöscht',
};

/**
 * Item status colors (for badges)
 */
export const ITEM_STATUS_COLORS: Record<
  ItemStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  [ItemStatus.InStock]: 'default',
  [ItemStatus.OutOfStock]: 'secondary',
  [ItemStatus.Reserved]: 'outline',
  [ItemStatus.OnBackorder]: 'outline',
  [ItemStatus.Lost]: 'destructive',
  [ItemStatus.Repairing]: 'outline',
  [ItemStatus.ForSale]: 'secondary',
  [ItemStatus.Deleted]: 'destructive',
};

/**
 * Item status options for selects/filters
 */
export const ITEM_STATUS_OPTIONS = Object.entries(ITEM_STATUS_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  })
);

/**
 * Rental status labels (German)
 */
export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  [RentalStatus.Active]: 'Aktiv',
  [RentalStatus.Returned]: 'Zurückgegeben',
  [RentalStatus.PartiallyReturned]: 'Teilweise zurück',
  [RentalStatus.Overdue]: 'Überfällig',
  [RentalStatus.DueToday]: 'Heute fällig',
  [RentalStatus.ReturnedToday]: 'Heute zurück',
};

/**
 * Rental status colors (for row highlighting)
 */
export const RENTAL_STATUS_COLORS: Record<RentalStatus, string> = {
  [RentalStatus.Active]: 'transparent',
  [RentalStatus.Returned]: 'hsl(120 60% 92%)', // faint green tint for all returned
  [RentalStatus.PartiallyReturned]: 'hsl(45 80% 88%)', // yellow tint for partial returns
  [RentalStatus.Overdue]: 'hsl(0 80% 92%)', // more visible light red
  [RentalStatus.DueToday]: 'hsl(210 70% 92%)', // more visible light blue
  [RentalStatus.ReturnedToday]: 'hsl(120 60% 92%)', // more visible light green
};

/**
 * Get item status label
 */
export function getItemStatusLabel(status: ItemStatus): string {
  return ITEM_STATUS_LABELS[status] || status;
}

/**
 * Get rental status label
 */
export function getRentalStatusLabel(status: RentalStatus): string {
  return RENTAL_STATUS_LABELS[status] || status;
}
