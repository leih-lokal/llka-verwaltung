import { describe, it, expect, afterEach, vi } from 'vitest';
import { calculateRentalStatus, calculateDaysOverdue, toBusinessDay } from '../formatting';
import { RentalStatus, type Rental } from '@/types';

// Results must not depend on the browser's time zone. Run with e.g.
// TZ=America/Los_Angeles or TZ=Asia/Tokyo to exercise that.

afterEach(() => {
  vi.useRealTimers();
});

/** Pin "now" to a UTC instant */
function setNow(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

/** A one-item rental from April 1st with the given return and due dates */
function rental(returned_on: string, expected_on: string): Rental {
  return {
    id: 'r0',
    items: ['a'],
    requested_copies: {},
    returned_items: {},
    rented_on: '2026-04-01 00:00:00.000Z',
    returned_on,
    expected_on,
    extended_on: '',
  } as unknown as Rental;
}

describe('toBusinessDay', () => {
  it('maps UTC-midnight date-only values to their calendar day', () => {
    expect(toBusinessDay('2026-04-15 00:00:00.000Z')).toBe('2026-04-15');
  });

  it('maps legacy local-midnight-in-UTC values to the intended day', () => {
    expect(toBusinessDay('2026-04-14 22:00:00.000Z')).toBe('2026-04-15'); // CEST
    expect(toBusinessDay('2026-01-14 23:00:00.000Z')).toBe('2026-01-15'); // CET
  });

  it('passes plain YYYY-MM-DD through unchanged', () => {
    expect(toBusinessDay('2026-04-15')).toBe('2026-04-15');
  });

  it('returns empty string for empty or invalid input', () => {
    expect(toBusinessDay('')).toBe('');
    expect(toBusinessDay(null)).toBe('');
    expect(toBusinessDay('not a date')).toBe('');
  });
});

describe('calculateRentalStatus', () => {
  it('is due today on the due day, including just after midnight Berlin time', () => {
    setNow('2026-04-14T22:30:00Z'); // 00:30 on the 15th in Berlin
    expect(calculateRentalStatus(rental('', '2026-04-15 00:00:00.000Z'))).toBe(
      RentalStatus.DueToday
    );
  });

  it('is overdue the day after, active the day before', () => {
    setNow('2026-04-16T10:00:00Z');
    expect(calculateRentalStatus(rental('', '2026-04-15 00:00:00.000Z'))).toBe(
      RentalStatus.Overdue
    );
    setNow('2026-04-14T10:00:00Z');
    expect(calculateRentalStatus(rental('', '2026-04-15 00:00:00.000Z'))).toBe(
      RentalStatus.Active
    );
  });

  it('detects returned today vs. earlier', () => {
    setNow('2026-04-15T21:30:00Z'); // 23:30 in Berlin
    expect(
      calculateRentalStatus(rental('2026-04-15 00:00:00.000Z', '2026-04-20 00:00:00.000Z'))
    ).toBe(RentalStatus.ReturnedToday);
    expect(
      calculateRentalStatus(rental('2026-04-14 00:00:00.000Z', '2026-04-20 00:00:00.000Z'))
    ).toBe(RentalStatus.Returned);
  });

  it('treats a missing or invalid due date as active', () => {
    setNow('2026-04-15T10:00:00Z');
    expect(calculateRentalStatus(rental('', ''))).toBe(RentalStatus.Active);
    expect(calculateRentalStatus(rental('', 'garbage'))).toBe(RentalStatus.Active);
  });
});

describe('calculateDaysOverdue', () => {
  it('counts calendar days across the DST change', () => {
    setNow('2026-10-26T10:00:00Z'); // day after DST ends in Berlin
    expect(calculateDaysOverdue('', '2026-10-24 00:00:00.000Z')).toBe(2);
  });

  it('is negative before the due date and 0 once returned', () => {
    setNow('2026-04-10T10:00:00Z');
    expect(calculateDaysOverdue('', '2026-04-15 00:00:00.000Z')).toBe(-5);
    expect(calculateDaysOverdue('2026-04-09 00:00:00.000Z', '2026-04-01 00:00:00.000Z')).toBe(0);
  });
});

describe('calculateRentalStatus with partial returns', () => {
  // Two items, one of them back
  const partial = (expected_on: string) =>
    ({
      id: 'r1',
      items: ['a', 'b'],
      requested_copies: {},
      returned_items: { a: 1 },
      rented_on: '2026-04-01 00:00:00.000Z',
      returned_on: '',
      expected_on,
      extended_on: '',
    }) as unknown as Rental;

  it('is partially returned while not yet due', () => {
    setNow('2026-04-10T10:00:00Z');
    expect(calculateRentalStatus(partial('2026-04-15 00:00:00.000Z'))).toBe(
      RentalStatus.PartiallyReturned
    );
  });

  it('stays overdue / due today when some items are back', () => {
    setNow('2026-04-16T10:00:00Z');
    expect(calculateRentalStatus(partial('2026-04-15 00:00:00.000Z'))).toBe(RentalStatus.Overdue);
    setNow('2026-04-15T10:00:00Z');
    expect(calculateRentalStatus(partial('2026-04-15 00:00:00.000Z'))).toBe(RentalStatus.DueToday);
  });

  it('is active when nothing is back yet', () => {
    setNow('2026-04-10T10:00:00Z');
    expect(
      calculateRentalStatus({ ...partial('2026-04-15 00:00:00.000Z'), returned_items: {} } as Rental)
    ).toBe(RentalStatus.Active);
  });
});
