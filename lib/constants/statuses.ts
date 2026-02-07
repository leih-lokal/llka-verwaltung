/**
 * Status constants and utilities
 */

import { BookingStatus, ItemStatus, RentalStatus } from '@/types';

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
 * - InStock (available): red/destructive to stand out
 * - All others: grey/secondary
 */
export const ITEM_STATUS_COLORS: Record<
  ItemStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  [ItemStatus.InStock]: 'destructive',
  [ItemStatus.OutOfStock]: 'secondary',
  [ItemStatus.Reserved]: 'secondary',
  [ItemStatus.OnBackorder]: 'secondary',
  [ItemStatus.Lost]: 'secondary',
  [ItemStatus.Repairing]: 'secondary',
  [ItemStatus.ForSale]: 'secondary',
  [ItemStatus.Deleted]: 'secondary',
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
 * Booking status labels (German)
 */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  [BookingStatus.Reserved]: 'Reserviert',
  [BookingStatus.Active]: 'Aktiv',
  [BookingStatus.Returned]: 'Zurückgegeben',
  [BookingStatus.Overdue]: 'Überfällig',
};

/**
 * Booking status colors (for grid blocks)
 */
export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  [BookingStatus.Reserved]: 'hsl(210 70% 92%)',
  [BookingStatus.Active]: 'hsl(120 60% 92%)',
  [BookingStatus.Returned]: 'hsl(0 0% 92%)',
  [BookingStatus.Overdue]: 'hsl(0 80% 92%)',
};

/**
 * Booking status text colors (for grid block text)
 */
export const BOOKING_STATUS_TEXT_COLORS: Record<BookingStatus, string> = {
  [BookingStatus.Reserved]: 'hsl(210 70% 30%)',
  [BookingStatus.Active]: 'hsl(120 60% 25%)',
  [BookingStatus.Returned]: 'hsl(0 0% 40%)',
  [BookingStatus.Overdue]: 'hsl(0 80% 30%)',
};

/**
 * Get booking status label
 */
export function getBookingStatusLabel(status: BookingStatus): string {
  return BOOKING_STATUS_LABELS[status] || status;
}

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
