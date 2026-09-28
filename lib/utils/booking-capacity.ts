/**
 * Booking capacity rules: how many copies of an item existing bookings hold
 * over a date range, and whether a new booking still fits.
 */

import { BookingStatus, type Booking } from '@/types';
import { toBusinessDay } from './formatting';

/** Statuses that still hold a copy of the item; returned bookings free it */
const OCCUPYING_STATUSES: ReadonlySet<string> = new Set([
  BookingStatus.Reserved,
  BookingStatus.Active,
  BookingStatus.Overdue,
]);

type BookingRange = Pick<Booking, 'start_date' | 'end_date' | 'status'>;

/**
 * Whether a booking still occupies a copy of its item
 */
export function occupiesItem(booking: Pick<Booking, 'status'>): boolean {
  return OCCUPYING_STATUSES.has(booking.status);
}

/**
 * Highest number of occupying bookings on any single day of [start, end].
 * Both ends are inclusive, so a booking ending on the day another starts
 * overlaps it. Dates may be PocketBase datetimes or YYYY-MM-DD strings and
 * are compared as calendar days.
 */
export function peakBookedCopies(
  bookings: BookingRange[],
  start: string,
  end: string
): number {
  const from = toBusinessDay(start);
  const to = toBusinessDay(end);
  if (!from || !to) return 0;

  const ranges = bookings
    .filter(occupiesItem)
    .map((b) => ({ start: toBusinessDay(b.start_date), end: toBusinessDay(b.end_date) }))
    .filter((r) => r.start && r.end && r.start <= to && r.end >= from);

  // The count only goes up on a day some booking starts, so the peak is on
  // `from` or on one of the start days inside the range. YYYY-MM-DD strings
  // compare chronologically.
  const checkpoints = [from, ...ranges.map((r) => r.start).filter((d) => d > from)];
  let peak = 0;
  for (const day of checkpoints) {
    const count = ranges.filter((r) => r.start <= day && r.end >= day).length;
    peak = Math.max(peak, count);
  }
  return peak;
}

export interface BookingCapacity {
  /** Total copies of the item */
  copies: number;
  /** Most copies booked on any day of the range */
  booked: number;
  /** Copies still free on every day of the range */
  available: number;
}

/**
 * Copies of an item that are still free over [start, end]
 *
 * @param copies - The item's `copies` field; missing or 0 counts as one copy
 * @param existing - Bookings of the same item (any status, any dates)
 */
export function getBookingCapacity(
  copies: number | undefined,
  existing: BookingRange[],
  start: string,
  end: string
): BookingCapacity {
  const total = Math.max(1, copies || 1);
  const booked = peakBookedCopies(existing, start, end);
  return { copies: total, booked, available: Math.max(0, total - booked) };
}

/**
 * User-facing reason why `requested` copies can't be booked, or null if
 * they fit
 */
export function bookingCapacityError(
  capacity: BookingCapacity,
  requested: number
): string | null {
  if (requested <= capacity.available) return null;
  if (capacity.copies === 1) {
    return 'Der Gegenstand ist in diesem Zeitraum bereits gebucht';
  }
  if (capacity.available === 0) {
    return `Alle ${capacity.copies} Exemplare sind in diesem Zeitraum bereits gebucht`;
  }
  return `In diesem Zeitraum sind nur noch ${capacity.available} von ${capacity.copies} Exemplaren frei`;
}
