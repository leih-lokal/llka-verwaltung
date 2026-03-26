import { describe, it, expect } from 'vitest';
import { generateMonthDates, getBookingSpan, OVERFLOW_DAYS } from '../booking-grid';

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
      booking: {} as any,
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
      booking: {} as any,
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
