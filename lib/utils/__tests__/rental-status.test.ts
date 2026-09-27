import { describe, it, expect, afterEach, vi } from 'vitest';
import { calculateRentalStatus, calculateDaysOverdue, toBusinessDay } from '../formatting';
import { RentalStatus } from '@/types';

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
    expect(calculateRentalStatus('2026-04-01 00:00:00.000Z', '', '2026-04-15 00:00:00.000Z')).toBe(
      RentalStatus.DueToday
    );
  });

  it('is overdue the day after, active the day before', () => {
    setNow('2026-04-16T10:00:00Z');
    expect(calculateRentalStatus('2026-04-01 00:00:00.000Z', '', '2026-04-15 00:00:00.000Z')).toBe(
      RentalStatus.Overdue
    );
    setNow('2026-04-14T10:00:00Z');
    expect(calculateRentalStatus('2026-04-01 00:00:00.000Z', '', '2026-04-15 00:00:00.000Z')).toBe(
      RentalStatus.Active
    );
  });

  it('detects returned today vs. earlier', () => {
    setNow('2026-04-15T21:30:00Z'); // 23:30 in Berlin
    expect(
      calculateRentalStatus('2026-04-01 00:00:00.000Z', '2026-04-15 00:00:00.000Z', '2026-04-20 00:00:00.000Z')
    ).toBe(RentalStatus.ReturnedToday);
    expect(
      calculateRentalStatus('2026-04-01 00:00:00.000Z', '2026-04-14 00:00:00.000Z', '2026-04-20 00:00:00.000Z')
    ).toBe(RentalStatus.Returned);
  });

  it('treats a missing or invalid due date as active', () => {
    setNow('2026-04-15T10:00:00Z');
    expect(calculateRentalStatus('2026-04-01 00:00:00.000Z', '', '')).toBe(RentalStatus.Active);
    expect(calculateRentalStatus('2026-04-01 00:00:00.000Z', '', 'garbage')).toBe(RentalStatus.Active);
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
