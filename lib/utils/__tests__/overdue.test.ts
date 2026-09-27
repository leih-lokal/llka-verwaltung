import { describe, it, expect, afterEach, vi } from 'vitest';
import { getOverdueSeverity, OVERDUE_LEVEL_DAYS } from '../overdue';
import { calculateOverdueBreakdown } from '../dashboard-metrics';
import type { RentalExpanded } from '@/types';

afterEach(() => {
  vi.useRealTimers();
});

// "Now" is 2026-04-15 12:00 in Berlin
function atNoonApril15() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-15T10:00:00Z'));
}

function rental(expectedDay: string, returnedOn = ''): RentalExpanded {
  return {
    id: expectedDay,
    rented_on: '2026-03-01 00:00:00.000Z',
    expected_on: `${expectedDay} 00:00:00.000Z`,
    returned_on: returnedOn,
  } as unknown as RentalExpanded;
}

describe('getOverdueSeverity', () => {
  it('uses the overdue page thresholds: 1-2 overdue, 3-6 critical, 7+ severely critical', () => {
    atNoonApril15();
    expect(getOverdueSeverity(rental('2026-04-14'))).toBe('overdue'); // 1 day
    expect(getOverdueSeverity(rental('2026-04-13'))).toBe('overdue'); // 2 days
    expect(getOverdueSeverity(rental('2026-04-12'))).toBe('critical'); // 3 days
    expect(getOverdueSeverity(rental('2026-04-09'))).toBe('critical'); // 6 days
    expect(getOverdueSeverity(rental('2026-04-08'))).toBe('severely_critical'); // 7 days
    expect(getOverdueSeverity(rental('2026-01-01'))).toBe('severely_critical');
  });

  it('buckets due today and due within 3 days', () => {
    atNoonApril15();
    expect(getOverdueSeverity(rental('2026-04-15'))).toBe('due_today');
    expect(getOverdueSeverity(rental('2026-04-16'))).toBe('due_soon');
    expect(getOverdueSeverity(rental('2026-04-18'))).toBe('due_soon');
    expect(getOverdueSeverity(rental('2026-04-19'))).toBeNull();
  });

  it('ignores returned rentals', () => {
    atNoonApril15();
    expect(getOverdueSeverity(rental('2026-04-01', '2026-04-10 00:00:00.000Z'))).toBeNull();
  });

  it('labels the day ranges to match', () => {
    expect(OVERDUE_LEVEL_DAYS).toEqual({
      severely_critical: '7+ Tage',
      critical: '3-6 Tage',
      overdue: '1-2 Tage',
    });
  });
});

describe('calculateOverdueBreakdown', () => {
  it('counts overdue rentals per level with the shared thresholds', () => {
    atNoonApril15();
    const breakdown = calculateOverdueBreakdown([
      rental('2026-04-14'), // 1 day
      rental('2026-04-12'), // 3 days (was "1-3" on the dashboard before)
      rental('2026-04-08'), // 7 days (was "4-7")
      rental('2026-04-07'), // 8 days
      rental('2026-04-15'), // due today: not overdue
      rental('2026-04-17'), // due soon: not overdue
    ]);
    expect(breakdown).toEqual({ overdue: 1, critical: 1, severely_critical: 2, total: 4 });
  });
});
