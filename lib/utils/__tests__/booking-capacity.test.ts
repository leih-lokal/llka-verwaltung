import { describe, it, expect } from 'vitest';
import {
  bookingCapacityError,
  getBookingCapacity,
  occupiesItem,
  peakBookedCopies,
} from '../booking-capacity';
import { BookingStatus } from '@/types';

function booking(start: string, end: string, status = BookingStatus.Reserved) {
  return {
    start_date: `${start} 00:00:00.000Z`,
    end_date: `${end} 00:00:00.000Z`,
    status,
  };
}

describe('occupiesItem', () => {
  it('counts reserved, active and overdue bookings, not returned ones', () => {
    expect(occupiesItem({ status: BookingStatus.Reserved })).toBe(true);
    expect(occupiesItem({ status: BookingStatus.Active })).toBe(true);
    expect(occupiesItem({ status: BookingStatus.Overdue })).toBe(true);
    expect(occupiesItem({ status: BookingStatus.Returned })).toBe(false);
  });
});

describe('peakBookedCopies', () => {
  it('is 0 without overlapping bookings', () => {
    const existing = [booking('2026-03-01', '2026-03-04'), booking('2026-03-11', '2026-03-12')];
    expect(peakBookedCopies(existing, '2026-03-05', '2026-03-10')).toBe(0);
  });

  it('treats both ends as inclusive', () => {
    expect(peakBookedCopies([booking('2026-03-01', '2026-03-05')], '2026-03-05', '2026-03-08')).toBe(1);
    expect(peakBookedCopies([booking('2026-03-08', '2026-03-09')], '2026-03-05', '2026-03-08')).toBe(1);
  });

  it('ignores returned bookings', () => {
    const existing = [booking('2026-03-01', '2026-03-10', BookingStatus.Returned)];
    expect(peakBookedCopies(existing, '2026-03-05', '2026-03-08')).toBe(0);
  });

  it('counts concurrent bookings, not every booking in the range', () => {
    // Two bookings inside the range that never overlap each other
    const existing = [booking('2026-03-01', '2026-03-03'), booking('2026-03-05', '2026-03-07')];
    expect(peakBookedCopies(existing, '2026-03-01', '2026-03-07')).toBe(1);
  });

  it('finds the peak on a start day inside the range', () => {
    const existing = [
      booking('2026-02-20', '2026-03-10'), // spans the whole range
      booking('2026-03-06', '2026-03-08'),
      booking('2026-03-07', '2026-03-09'),
    ];
    expect(peakBookedCopies(existing, '2026-03-01', '2026-03-31')).toBe(3);
  });

  it('matches legacy local-midnight dates to the intended day', () => {
    // Stored as local midnight in UTC: 2026-03-04 23:00Z is 2026-03-05 in Berlin
    const existing = [
      { start_date: '2026-03-01 23:00:00.000Z', end_date: '2026-03-04 23:00:00.000Z', status: BookingStatus.Reserved },
    ];
    expect(peakBookedCopies(existing, '2026-03-05', '2026-03-08')).toBe(1);
    expect(peakBookedCopies(existing, '2026-03-06', '2026-03-08')).toBe(0);
  });
});

describe('getBookingCapacity / bookingCapacityError', () => {
  it('refuses a single-copy item that is already booked', () => {
    const capacity = getBookingCapacity(1, [booking('2026-03-01', '2026-03-05')], '2026-03-04', '2026-03-06');
    expect(capacity).toEqual({ copies: 1, booked: 1, available: 0 });
    expect(bookingCapacityError(capacity, 1)).toBe('Der Gegenstand ist in diesem Zeitraum bereits gebucht');
  });

  it('treats missing or zero copies as one copy', () => {
    expect(getBookingCapacity(undefined, [], '2026-03-01', '2026-03-02').copies).toBe(1);
    expect(getBookingCapacity(0, [], '2026-03-01', '2026-03-02').copies).toBe(1);
  });

  it('allows a booking that fits the free copies', () => {
    const capacity = getBookingCapacity(3, [booking('2026-03-01', '2026-03-05')], '2026-03-04', '2026-03-06');
    expect(capacity.available).toBe(2);
    expect(bookingCapacityError(capacity, 2)).toBeNull();
  });

  it('refuses when existing + requested exceeds the copies', () => {
    const existing = [booking('2026-03-01', '2026-03-05'), booking('2026-03-02', '2026-03-04')];
    const capacity = getBookingCapacity(3, existing, '2026-03-03', '2026-03-06');
    expect(bookingCapacityError(capacity, 2)).toBe(
      'In diesem Zeitraum sind nur noch 1 von 3 Exemplaren frei'
    );
    const full = getBookingCapacity(2, existing, '2026-03-03', '2026-03-06');
    expect(bookingCapacityError(full, 1)).toBe('Alle 2 Exemplare sind in diesem Zeitraum bereits gebucht');
  });

  it('refuses more copies than the item has, even when nothing is booked', () => {
    const capacity = getBookingCapacity(2, [], '2026-03-01', '2026-03-02');
    expect(bookingCapacityError(capacity, 3)).not.toBeNull();
  });
});
