/**
 * Pure utility functions for the booking grid
 */

import { parseISO, startOfDay } from 'date-fns';
import { DEFAULT_SETTINGS, type BookingExpanded, type Item } from '@/types';
import { occupiesItem, peakBookedCopies } from './booking-capacity';

export const OVERFLOW_DAYS = 5;

/** opening_hours day keys, indexed like Date.getDay() */
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export interface GridDate {
  date: Date;
  isOverflow: boolean;
}

/**
 * A column in the booking grid: a data lane, a "plus" column for
 * creating bookings on multi-copy items, or a single-copy column.
 */
export interface ItemColumn {
  /** Unique key for this column */
  key: string;
  /** The item record */
  item: Item;
  /**
   * 1-based lane index for data/single columns, 0 for plus columns.
   * Single-copy items get lanes > 1 only for overlapping (conflicting) bookings.
   */
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
  /** More occupying bookings than copies on some day of this booking */
  conflict?: boolean;
}

/**
 * Parse a PocketBase datetime ("YYYY-MM-DD HH:MM:SS.sssZ"). `new Date()`
 * rejects the space separator in older Safari (iPad); parseISO accepts it and
 * yields the same instant.
 */
export function parseBookingDate(value: string): Date {
  return parseISO(value);
}

/**
 * Greedy lane assignment: each entry goes into the leftmost lane whose last
 * entry ended on an earlier calendar day. Entries must be sorted by start.
 * Returns the 0-based lane per entry.
 */
function assignLanes<T>(
  entries: T[],
  getStart: (entry: T) => Date,
  getEnd: (entry: T) => Date
): { lanes: number[]; laneCount: number } {
  const laneEnds: number[] = [];
  const lanes = entries.map((entry) => {
    const start = startOfDay(getStart(entry)).getTime();
    let lane = laneEnds.findIndex((end) => end < start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = startOfDay(getEnd(entry)).getTime();
    return lane;
  });
  return { lanes, laneCount: laneEnds.length };
}

/**
 * Generate all dates in a given month, optionally with overflow days
 * from the previous and next months.
 */
export function generateMonthDates(
  year: number,
  month: number,
  overflowDays: number = 0
): GridDate[] {
  const dates: GridDate[] = [];

  // Previous month overflow
  if (overflowDays > 0) {
    const firstDay = new Date(year, month, 1);
    for (let i = overflowDays; i > 0; i--) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - i);
      dates.push({ date: d, isOverflow: true });
    }
  }

  // Current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    dates.push({ date: new Date(year, month, day), isOverflow: false });
  }

  // Next month overflow
  if (overflowDays > 0) {
    const lastDay = new Date(year, month + 1, 0);
    for (let i = 1; i <= overflowDays; i++) {
      const d = new Date(lastDay);
      d.setDate(d.getDate() + i);
      dates.push({ date: d, isOverflow: true });
    }
  }

  return dates;
}

/**
 * Weekdays (0 = Sunday, like Date.getDay()) that have no opening hours.
 * Uses the default opening hours when `openingHours` isn't a list (e.g.
 * records created before the field existed).
 */
export function getClosedWeekdays(openingHours: unknown): Set<number> {
  const hours = Array.isArray(openingHours)
    ? openingHours
    : DEFAULT_SETTINGS.opening_hours;
  const openDays = new Set(
    hours
      .filter((entry): entry is unknown[] => Array.isArray(entry))
      .map(([day]) => WEEKDAY_KEYS.indexOf(String(day)))
  );
  return new Set(WEEKDAY_KEYS.map((_, i) => i).filter((i) => !openDays.has(i)));
}

/**
 * Build columns and assign bookings to lanes in a single pass.
 *
 * - Single-copy items (copies=1): one column. Overlapping bookings (a double
 *   booking) spill into extra columns so none is drawn over another.
 * - Multi-copy items (copies>1): dynamic data columns based on max concurrent
 *   booking groups, plus a narrow "+" column for creating bookings.
 *   Bookings sharing (customer_name, start_date, end_date) form one visual
 *   group per lane. Lane count = max(1, max concurrent groups).
 *
 * Bookings are flagged as `conflict` when, on some day of their range, more
 * occupying bookings exist than the item has copies.
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
      .map((booking) => ({
        booking,
        startDate: parseBookingDate(booking.start_date),
        endDate: parseBookingDate(booking.end_date),
      }))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    const records = itemBookings.map((e) => e.booking);
    const isConflict = (booking: BookingExpanded) =>
      occupiesItem(booking) &&
      peakBookedCopies(records, booking.start_date, booking.end_date) > copies;

    if (copies <= 1) {
      // Single-copy item: one column, plus one per extra overlapping booking
      const { lanes, laneCount } = assignLanes(
        itemBookings,
        (e) => e.startDate,
        (e) => e.endDate
      );
      for (let lane = 1; lane <= Math.max(1, laneCount); lane++) {
        columns.push({
          key: `${item.id}-${lane}`,
          item,
          laneIndex: lane,
          totalCopies: 1,
          isPlusColumn: false,
        });
      }
      itemBookings.forEach(({ booking, startDate, endDate }, i) => {
        bookingSlots.push({
          booking,
          columnKey: `${item.id}-${lanes[i] + 1}`,
          startDate,
          endDate,
          conflict: isConflict(booking),
        });
      });
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
      for (const { booking, startDate, endDate } of itemBookings) {
        const k = groupKeyFn(booking);
        let group = groupMap.get(k);
        if (!group) {
          group = { bookings: [], startDate, endDate };
          groupMap.set(k, group);
        }
        group.bookings.push(booking);
      }

      const groups = Array.from(groupMap.values()).sort(
        (a, b) => a.startDate.getTime() - b.startDate.getTime()
      );

      // Greedy lane assignment on groups (leftmost first)
      const assigned = assignLanes(
        groups,
        (g) => g.startDate,
        (g) => g.endDate
      );
      const groupLanes = assigned.lanes;
      const laneCount = Math.max(1, assigned.laneCount);

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
            startDate: groups[gi].startDate,
            endDate: groups[gi].endDate,
            conflict: isConflict(booking),
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
 * Count how many days a booking spans within a given date range (including overflow)
 */
export function getBookingSpan(
  slot: BookingSlot,
  dates: GridDate[]
): { startRow: number; endRow: number } | null {
  if (dates.length === 0) return null;

  const monthStart = dates[0].date;
  const monthEnd = dates[dates.length - 1].date;

  const clampedStart =
    slot.startDate < monthStart ? monthStart : slot.startDate;
  const clampedEnd = slot.endDate > monthEnd ? monthEnd : slot.endDate;

  const startRow = dates.findIndex(
    (d) =>
      d.date.getFullYear() === clampedStart.getFullYear() &&
      d.date.getMonth() === clampedStart.getMonth() &&
      d.date.getDate() === clampedStart.getDate()
  );

  const endRow = dates.findIndex(
    (d) =>
      d.date.getFullYear() === clampedEnd.getFullYear() &&
      d.date.getMonth() === clampedEnd.getMonth() &&
      d.date.getDate() === clampedEnd.getDate()
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
