/**
 * Pure utility functions for the booking grid
 */

import type { BookingExpanded, Item } from '@/types';

/**
 * A column in the booking grid representing one copy of a protected item
 */
export interface ItemColumn {
  /** Unique key: `${item.id}-${copyIndex}` */
  key: string;
  /** The item record */
  item: Item;
  /** 1-based copy index */
  copyIndex: number;
  /** Total copies for this item */
  totalCopies: number;
}

/**
 * A booking positioned in a specific lane (copy column)
 */
export interface BookingSlot {
  booking: BookingExpanded;
  /** Which item column this booking is assigned to */
  columnKey: string;
  /** Start date (inclusive) */
  startDate: Date;
  /** End date (inclusive) */
  endDate: Date;
}

/**
 * Generate all dates in a given month
 */
export function generateMonthDates(year: number, month: number): Date[] {
  const dates: Date[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(new Date(year, month, day));
  }
  return dates;
}

/**
 * Build item columns: one entry per item × copy
 * Items with copies=1 get a single column, copies=3 gets 3 columns
 */
export function buildItemColumns(items: Item[]): ItemColumn[] {
  const columns: ItemColumn[] = [];
  for (const item of items) {
    const copies = Math.max(1, item.copies);
    for (let i = 1; i <= copies; i++) {
      columns.push({
        key: `${item.id}-${i}`,
        item,
        copyIndex: i,
        totalCopies: copies,
      });
    }
  }
  return columns;
}

/**
 * Assign bookings to lanes (copy columns) using a greedy algorithm.
 * For each item, sort bookings by start_date, then assign each to the
 * first lane whose last booking ended before this one starts.
 */
export function assignBookingsToLanes(
  bookings: BookingExpanded[],
  items: Item[]
): BookingSlot[] {
  const slots: BookingSlot[] = [];

  for (const item of items) {
    const copies = Math.max(1, item.copies);
    const itemBookings = bookings
      .filter((b) => b.item === item.id)
      .sort(
        (a, b) =>
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );

    // Track end date of last booking assigned to each lane
    const laneEnds: (Date | null)[] = Array.from(
      { length: copies },
      () => null
    );

    for (const booking of itemBookings) {
      const startDate = new Date(booking.start_date);
      const endDate = new Date(booking.end_date);

      // Find first lane where the last booking ended before this one starts
      let assignedLane = -1;
      for (let lane = 0; lane < copies; lane++) {
        if (laneEnds[lane] === null || laneEnds[lane]! < startDate) {
          assignedLane = lane;
          break;
        }
      }

      // If no lane is free, force-assign to the first lane (overlap — shouldn't happen with valid data)
      if (assignedLane === -1) {
        assignedLane = 0;
      }

      laneEnds[assignedLane] = endDate;
      slots.push({
        booking,
        columnKey: `${item.id}-${assignedLane + 1}`,
        startDate,
        endDate,
      });
    }
  }

  return slots;
}

/**
 * Get the booking slot for a given date and column, if any
 */
export function getBookingForCell(
  date: Date,
  columnKey: string,
  slots: BookingSlot[]
): BookingSlot | undefined {
  return slots.find((slot) => {
    if (slot.columnKey !== columnKey) return false;
    // Normalize to day boundaries for comparison
    const start = new Date(
      slot.startDate.getFullYear(),
      slot.startDate.getMonth(),
      slot.startDate.getDate()
    ).getTime();
    const end = new Date(
      slot.endDate.getFullYear(),
      slot.endDate.getMonth(),
      slot.endDate.getDate()
    ).getTime();
    const target = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).getTime();
    return target >= start && target <= end;
  });
}

/**
 * Check if a date is the start date of a booking slot
 */
export function isBookingStart(
  date: Date,
  slot: BookingSlot
): boolean {
  return (
    date.getFullYear() === slot.startDate.getFullYear() &&
    date.getMonth() === slot.startDate.getMonth() &&
    date.getDate() === slot.startDate.getDate()
  );
}

/**
 * Count how many days a booking spans within a given month
 */
export function getBookingSpanInMonth(
  slot: BookingSlot,
  dates: Date[]
): { startRow: number; endRow: number } | null {
  if (dates.length === 0) return null;

  const monthStart = dates[0];
  const monthEnd = dates[dates.length - 1];

  // Clamp booking dates to the month boundaries
  const clampedStart =
    slot.startDate < monthStart ? monthStart : slot.startDate;
  const clampedEnd = slot.endDate > monthEnd ? monthEnd : slot.endDate;

  const startRow = dates.findIndex(
    (d) =>
      d.getFullYear() === clampedStart.getFullYear() &&
      d.getMonth() === clampedStart.getMonth() &&
      d.getDate() === clampedStart.getDate()
  );

  const endRow = dates.findIndex(
    (d) =>
      d.getFullYear() === clampedEnd.getFullYear() &&
      d.getMonth() === clampedEnd.getMonth() &&
      d.getDate() === clampedEnd.getDate()
  );

  if (startRow === -1 || endRow === -1) return null;

  // +2 because grid row 1 is the header, and CSS grid rows are 1-indexed
  return { startRow: startRow + 2, endRow: endRow + 3 };
}

/**
 * Format a column header label
 */
export function getColumnLabel(column: ItemColumn): string {
  if (column.totalCopies === 1) {
    return column.item.name;
  }
  return `${column.item.name} ${column.copyIndex}/${column.totalCopies}`;
}
