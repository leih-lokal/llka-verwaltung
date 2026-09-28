import { describe, it, expect } from 'vitest';
import { extendedDueDate } from '../rental-extension';

// Results must not depend on the browser's time zone. Run with e.g.
// TZ=America/Los_Angeles or TZ=Asia/Tokyo to exercise that.

const NOW = new Date('2026-09-27T10:00:00Z'); // 27 Sep, Berlin

describe('extendedDueDate', () => {
  it('extends an overdue rental from today', () => {
    // 20 days overdue: +7 from the old due date would still be overdue
    expect(extendedDueDate('2026-09-07 00:00:00.000Z', 7, NOW)).toBe('2026-10-04');
    expect(extendedDueDate('2026-09-07 00:00:00.000Z', 14, NOW)).toBe('2026-10-11');
  });

  it('extends a rental due today from today', () => {
    expect(extendedDueDate('2026-09-27 00:00:00.000Z', 7, NOW)).toBe('2026-10-04');
  });

  it('extends a rental not yet due from its due date', () => {
    expect(extendedDueDate('2026-10-01 00:00:00.000Z', 7, NOW)).toBe('2026-10-08');
  });

  it('reads legacy local-midnight-in-UTC due dates as their Berlin day', () => {
    // 2026-09-30 22:00Z is midnight 1 Oct in Berlin
    expect(extendedDueDate('2026-09-30 22:00:00.000Z', 7, NOW)).toBe('2026-10-08');
  });

  it('uses the Berlin calendar day for "today"', () => {
    // 22:30Z on 26 Sep is already 27 Sep in Berlin
    const justAfterMidnight = new Date('2026-09-26T22:30:00Z');
    expect(extendedDueDate('2026-09-26 00:00:00.000Z', 7, justAfterMidnight)).toBe('2026-10-04');
  });

  it('counts calendar days across a DST change', () => {
    // DST ends 25 Oct 2026
    expect(extendedDueDate('2026-10-20 00:00:00.000Z', 14, NOW)).toBe('2026-11-03');
  });

  it('extends from today when there is no due date', () => {
    expect(extendedDueDate('', 7, NOW)).toBe('2026-10-04');
    expect(extendedDueDate(undefined, 7, NOW)).toBe('2026-10-04');
  });
});
