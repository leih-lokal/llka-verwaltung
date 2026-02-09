/**
 * Pure utility functions for the booking grid
 */

import type { BookingExpanded, Item } from '@/types';

/**
 * A column in the booking grid: a data lane, a "plus" column for
 * creating bookings on multi-copy items, or a single-copy column.
 */
export interface ItemColumn {
  /** Unique key for this column */
  key: string;
  /** The item record */
  item: Item;
  /** 1-based lane index for data/single columns, 0 for plus columns */
  laneIndex: number;
  /** Total copies for this item */
  totalCopies: number;
  /** Plus column: always empty, narrow, used for creating new bookings */
  isPlusColumn: boolean;
}

/**
 * A booking positioned in a specific lane (column)
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
 * Build columns and assign bookings to lanes in a single pass.
 *
 * - Single-copy items (copies=1): one column, bookings assigned directly.
 * - Multi-copy items (copies>1): dynamic data columns based on max concurrent
 *   booking groups, plus a narrow "+" column for creating bookings.
 *   Bookings sharing (customer_name, start_date, end_date) form one visual
 *   group per lane. Lane count = max(1, max concurrent groups).
 */
export function buildBookingGrid(
  items: Item[],
  bookings: BookingExpanded[]
): { columns: ItemColumn[]; bookingSlots: BookingSlot[] } {
  const columns: ItemColumn[] = [];
  const bookingSlots: BookingSlot[] = [];

  for (const item of items) {
    const copies = Math.max(1, item.copies);
    const itemBookings = bookings
      .filter((b) => b.item === item.id)
      .sort(
        (a, b) =>
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );

    if (copies <= 1) {
      // Single-copy item: one column
      columns.push({
        key: `${item.id}-1`,
        item,
        laneIndex: 1,
        totalCopies: 1,
        isPlusColumn: false,
      });
      for (const booking of itemBookings) {
        bookingSlots.push({
          booking,
          columnKey: `${item.id}-1`,
          startDate: new Date(booking.start_date),
          endDate: new Date(booking.end_date),
        });
      }
    } else {
      // Multi-copy: group bookings by identity, assign groups to visual lanes
      const groupKeyFn = (b: BookingExpanded) =>
        `${b.customer_name}|${b.start_date}|${b.end_date}`;

      interface BookingGroup {
        bookings: BookingExpanded[];
        startDate: Date;
        endDate: Date;
      }

      const groupMap = new Map<string, BookingGroup>();
      for (const booking of itemBookings) {
        const k = groupKeyFn(booking);
        let group = groupMap.get(k);
        if (!group) {
          group = {
            bookings: [],
            startDate: new Date(booking.start_date),
            endDate: new Date(booking.end_date),
          };
          groupMap.set(k, group);
        }
        group.bookings.push(booking);
      }

      const groups = Array.from(groupMap.values()).sort(
        (a, b) => a.startDate.getTime() - b.startDate.getTime()
      );

      // Greedy lane assignment on groups (leftmost first)
      const laneEnds: (Date | null)[] = [];
      const groupLanes: number[] = [];
      for (const group of groups) {
        let assignedLane = -1;
        for (let lane = 0; lane < laneEnds.length; lane++) {
          if (laneEnds[lane] === null || laneEnds[lane]! < group.startDate) {
            assignedLane = lane;
            break;
          }
        }
        if (assignedLane === -1) {
          assignedLane = laneEnds.length;
          laneEnds.push(null);
        }
        laneEnds[assignedLane] = group.endDate;
        groupLanes.push(assignedLane);
      }

      const laneCount = Math.max(1, laneEnds.length);

      // Data columns (one per visual lane)
      for (let lane = 1; lane <= laneCount; lane++) {
        columns.push({
          key: `${item.id}-lane-${lane}`,
          item,
          laneIndex: lane,
          totalCopies: copies,
          isPlusColumn: false,
        });
      }

      // Plus column
      columns.push({
        key: `${item.id}-plus`,
        item,
        laneIndex: 0,
        totalCopies: copies,
        isPlusColumn: true,
      });

      // Assign booking records to their group's lane
      for (let gi = 0; gi < groups.length; gi++) {
        const lane = groupLanes[gi] + 1; // 1-based
        for (const booking of groups[gi].bookings) {
          bookingSlots.push({
            booking,
            columnKey: `${item.id}-lane-${lane}`,
            startDate: new Date(booking.start_date),
            endDate: new Date(booking.end_date),
          });
        }
      }
    }
  }

  return { columns, bookingSlots };
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
export function isBookingStart(date: Date, slot: BookingSlot): boolean {
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
  if (column.isPlusColumn) {
    return '+';
  }
  if (column.totalCopies <= 1) {
    return column.item.name;
  }
  return `${column.item.name} (${column.totalCopies}×)`;
}
