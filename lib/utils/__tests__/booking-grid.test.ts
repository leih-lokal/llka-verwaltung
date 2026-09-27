import { describe, it, expect } from 'vitest';
import {
  buildBookingGrid,
  generateMonthDates,
  getBookingSpan,
  parseBookingDate,
} from '../booking-grid';
import { BookingStatus } from '@/types';
import type { BookingExpanded, Item } from '@/types';

function item(id: string, copies: number): Item {
  return { id, name: id, iid: 1, copies } as unknown as Item;
}

let nextId = 0;
function booking(
  itemId: string,
  start: string,
  end: string,
  customer = `Kunde ${++nextId}`,
  status = BookingStatus.Reserved
): BookingExpanded {
  return {
    id: `b${++nextId}`,
    item: itemId,
    customer_name: customer,
    start_date: `${start} 00:00:00.000Z`,
    end_date: `${end} 00:00:00.000Z`,
    status,
  } as unknown as BookingExpanded;
}

describe('generateMonthDates', () => {
  it('returns only main month dates when overflowDays=0', () => {
    const dates = generateMonthDates(2026, 2); // March 2026 = 31 days
    expect(dates).toHaveLength(31);
    expect(dates.every((d) => !d.isOverflow)).toBe(true);
    expect(dates[0].date.getDate()).toBe(1);
    expect(dates[30].date.getDate()).toBe(31);
  });

  it('adds overflow days before and after the month', () => {
    const dates = generateMonthDates(2026, 2, 5); // March 2026
    expect(dates).toHaveLength(31 + 5 + 5);
    // First 5 are Feb overflow
    expect(dates[0].isOverflow).toBe(true);
    expect(dates[0].date.getMonth()).toBe(1); // February
    expect(dates[4].isOverflow).toBe(true);
    // Main month starts at index 5
    expect(dates[5].isOverflow).toBe(false);
    expect(dates[5].date.getDate()).toBe(1);
    expect(dates[5].date.getMonth()).toBe(2); // March
    // Last 5 are April overflow
    expect(dates[36].isOverflow).toBe(true);
    expect(dates[36].date.getMonth()).toBe(3); // April
  });

  it('handles year boundary (January with overflow into December)', () => {
    const dates = generateMonthDates(2026, 0, 5); // January 2026
    expect(dates[0].date.getFullYear()).toBe(2025);
    expect(dates[0].date.getMonth()).toBe(11); // December
    expect(dates[0].isOverflow).toBe(true);
  });
});

describe('getBookingSpan', () => {
  it('returns correct span for a booking within the date range', () => {
    const dates = generateMonthDates(2026, 2, 5);
    const slot = {
      booking: {} as unknown as BookingExpanded,
      columnKey: 'test',
      startDate: new Date(2026, 2, 5),
      endDate: new Date(2026, 2, 10),
    };
    const span = getBookingSpan(slot, dates);
    expect(span).not.toBeNull();
    expect(span!.startRow).toBeGreaterThan(1);
  });

  it('returns span for a booking in overflow range', () => {
    const dates = generateMonthDates(2026, 2, 5);
    const slot = {
      booking: {} as unknown as BookingExpanded,
      columnKey: 'test',
      startDate: new Date(2026, 1, 24), // Feb 24 (first overflow day, index 0)
      endDate: new Date(2026, 2, 3),    // Mar 3
    };
    const span = getBookingSpan(slot, dates);
    expect(span).not.toBeNull();
    // Feb 24 is index 0 → startRow = 0 + 2 = 2
    expect(span!.startRow).toBe(2);
  });
});

describe('parseBookingDate', () => {
  it('parses PocketBase datetimes with a space separator', () => {
    expect(parseBookingDate('2026-03-05 00:00:00.000Z').getTime()).toBe(Date.UTC(2026, 2, 5));
    expect(parseBookingDate('2026-03-05 13:45:10.123Z').getTime()).toBe(
      Date.UTC(2026, 2, 5, 13, 45, 10, 123)
    );
  });
});

describe('buildBookingGrid', () => {
  it('keeps non-overlapping bookings of a single-copy item in one column', () => {
    const { columns, bookingSlots } = buildBookingGrid(
      [item('a', 1)],
      [booking('a', '2026-03-01', '2026-03-03'), booking('a', '2026-03-04', '2026-03-06')]
    );
    expect(columns.map((c) => c.key)).toEqual(['a-1']);
    expect(bookingSlots.map((s) => s.columnKey)).toEqual(['a-1', 'a-1']);
    expect(bookingSlots.every((s) => !s.conflict)).toBe(true);
  });

  it('spills overlapping bookings of a single-copy item into a further column and flags them', () => {
    const { columns, bookingSlots } = buildBookingGrid(
      [item('a', 1)],
      [booking('a', '2026-03-01', '2026-03-05'), booking('a', '2026-03-05', '2026-03-08')]
    );
    expect(columns.map((c) => c.key)).toEqual(['a-1', 'a-2']);
    expect(columns.every((c) => c.totalCopies === 1 && !c.isPlusColumn)).toBe(true);
    expect(bookingSlots.map((s) => s.columnKey)).toEqual(['a-1', 'a-2']);
    expect(bookingSlots.every((s) => s.conflict)).toBe(true);
  });

  it('shows but does not flag an overlap with a returned booking', () => {
    const { columns, bookingSlots } = buildBookingGrid(
      [item('a', 1)],
      [
        booking('a', '2026-03-01', '2026-03-05', 'X', BookingStatus.Returned),
        booking('a', '2026-03-03', '2026-03-08'),
      ]
    );
    expect(columns).toHaveLength(2);
    expect(bookingSlots.some((s) => s.conflict)).toBe(false);
  });

  it('flags bookings of a multi-copy item that exceed its copies', () => {
    const { bookingSlots } = buildBookingGrid(
      [item('m', 2)],
      [
        booking('m', '2026-03-01', '2026-03-10'),
        booking('m', '2026-03-02', '2026-03-04'),
        booking('m', '2026-03-12', '2026-03-14'),
        booking('m', '2026-03-03', '2026-03-05'),
      ]
    );
    const conflicts = bookingSlots.filter((s) => s.conflict).map((s) => s.booking.start_date.slice(0, 10));
    expect(conflicts.sort()).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
  });

  it('assigns multi-copy groups to lanes by calendar day', () => {
    const { columns, bookingSlots } = buildBookingGrid(
      [item('m', 3)],
      [
        booking('m', '2026-03-01', '2026-03-05', 'A'),
        booking('m', '2026-03-01', '2026-03-05', 'A'),
        booking('m', '2026-03-05', '2026-03-07', 'B'),
        booking('m', '2026-03-06', '2026-03-09', 'C'),
      ]
    );
    expect(columns.map((c) => c.key)).toEqual(['m-lane-1', 'm-lane-2', 'm-plus']);
    // A's group shares a lane; B starts on A's last day so needs lane 2; C fits after A
    expect(bookingSlots.map((s) => `${s.booking.customer_name}:${s.columnKey}`)).toEqual([
      'A:m-lane-1',
      'A:m-lane-1',
      'B:m-lane-2',
      'C:m-lane-1',
    ]);
  });
});
