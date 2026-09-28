/**
 * Booking creation: refuses double bookings and creates multi-copy bookings
 * all-or-nothing.
 */

import { addDays } from 'date-fns';
import { collections, pb } from '@/lib/pocketbase/client';
import { localStringToDate, toBusinessDay } from '@/lib/utils/formatting';
import { bookingCapacityError, getBookingCapacity } from '@/lib/utils/booking-capacity';
import type { Booking } from '@/types';

/** Fields sent when creating a booking record */
export type NewBooking = Omit<Booking, 'id' | 'created' | 'updated' | 'associated_rental'>;

/**
 * The requested copies aren't free. The message is user-facing.
 */
export class BookingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingConflictError';
  }
}

/**
 * Throw a BookingConflictError unless `requested` more copies of the item
 * are free on every day of [start, end].
 *
 * @param copies - The item's `copies` field
 * @param excludeBookingId - Booking to leave out of the count (when editing it)
 */
export async function assertBookingCapacity(
  itemId: string,
  copies: number | undefined,
  start: string,
  end: string,
  requested: number,
  excludeBookingId?: string
): Promise<void> {
  // Widen the query by a day on each side so records stored as local
  // midnight in UTC are included; getBookingCapacity compares calendar days.
  const from = addDays(localStringToDate(toBusinessDay(start)), -1);
  const to = addDays(localStringToDate(toBusinessDay(end)), 2);

  const existing = await collections.bookings().getFullList<Booking>({
    filter: pb.filter('item = {:item} && start_date < {:to} && end_date >= {:from}', {
      item: itemId,
      from,
      to,
    }),
    fields: 'id,start_date,end_date,status',
  });

  const capacity = getBookingCapacity(
    copies,
    existing.filter((b) => b.id !== excludeBookingId),
    start,
    end
  );
  const message = bookingCapacityError(capacity, requested);
  if (message) throw new BookingConflictError(message);
}

/**
 * Create `count` identical bookings (one per copy) after checking capacity.
 *
 * Records are created one after another; if one fails, those already created
 * in this call are deleted again before the error is rethrown, so a retry
 * doesn't duplicate them.
 *
 * @param copies - The item's `copies` field
 * @throws BookingConflictError if the copies aren't free, or the create error
 */
export async function createBookings(
  data: NewBooking,
  count: number,
  copies: number | undefined
): Promise<Booking[]> {
  await assertBookingCapacity(data.item, copies, data.start_date, data.end_date, count);

  const created: Booking[] = [];
  try {
    for (let i = 0; i < count; i++) {
      created.push(await collections.bookings().create<Booking>(data));
    }
  } catch (err) {
    const results = await Promise.allSettled(
      created.map((b) => collections.bookings().delete(b.id))
    );
    const leftOver = results.filter((r) => r.status === 'rejected').length;
    if (leftOver > 0) {
      console.error(`Rollback failed for ${leftOver} booking(s):`, results);
      throw new Error(
        `Fehler beim Erstellen der Buchung. ${leftOver} bereits angelegte Buchung(en) konnten nicht entfernt werden – bitte im Raster prüfen.`,
        { cause: err }
      );
    }
    throw err;
  }
  return created;
}
