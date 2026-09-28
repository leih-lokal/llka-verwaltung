import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildRentalTemplate,
  calculateRentalDeposit,
  getDefaultExpectedDate,
} from '../rental-template';
import type { Customer, Item } from '@/types';

/** Local calendar date as YYYY-MM-DD (tests must not depend on the TZ) */
function ymd(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

// Wednesday 2026-09-23, 16:50 local time
const NOW = new Date(2026, 8, 23, 16, 50);

describe('getDefaultExpectedDate', () => {
  it('defaults to today + 7 days without a pickup', () => {
    expect(ymd(getDefaultExpectedDate(undefined, NOW))).toBe('2026-09-30');
    expect(ymd(getDefaultExpectedDate(null, NOW))).toBe('2026-09-30');
    expect(ymd(getDefaultExpectedDate('', NOW))).toBe('2026-09-30');
  });

  it('returns local midnight', () => {
    const expected = getDefaultExpectedDate(undefined, NOW);
    expect(expected.getHours()).toBe(0);
    expect(expected.getMinutes()).toBe(0);
  });

  it('starts today for a pickup later today (not due back today)', () => {
    const pickup = new Date(2026, 8, 23, 17, 0).toISOString();
    expect(ymd(getDefaultExpectedDate(pickup, NOW))).toBe('2026-09-30');
  });

  it('starts today for a pickup earlier today', () => {
    const pickup = new Date(2026, 8, 23, 9, 0).toISOString();
    expect(ymd(getDefaultExpectedDate(pickup, NOW))).toBe('2026-09-30');
  });

  it('starts at the pickup day for a future pickup', () => {
    const pickup = new Date(2026, 8, 26, 10, 0).toISOString();
    expect(ymd(getDefaultExpectedDate(pickup, NOW))).toBe('2026-10-03');
  });

  it('starts at the pickup day for an early-morning pickup tomorrow', () => {
    const pickup = new Date(2026, 8, 24, 0, 30).toISOString();
    expect(ymd(getDefaultExpectedDate(pickup, NOW))).toBe('2026-10-01');
  });

  it('starts today for a past pickup', () => {
    const pickup = new Date(2026, 8, 20, 10, 0).toISOString();
    expect(ymd(getDefaultExpectedDate(pickup, NOW))).toBe('2026-09-30');
  });

  it('parses PocketBase datetimes (space separator)', () => {
    const pickup = new Date(2026, 8, 26, 10, 0).toISOString().replace('T', ' ');
    expect(ymd(getDefaultExpectedDate(pickup, NOW))).toBe('2026-10-03');
  });

  it('ignores an unparseable pickup', () => {
    expect(ymd(getDefaultExpectedDate('not a date', NOW))).toBe('2026-09-30');
  });

  it('counts calendar days across a DST change', () => {
    // EU daylight saving time ends on 2026-10-25
    const now = new Date(2026, 9, 22, 12, 0);
    expect(ymd(getDefaultExpectedDate(undefined, now))).toBe('2026-10-29');
    const expected = getDefaultExpectedDate(undefined, now);
    expect(expected.getHours()).toBe(0);
  });
});

describe('calculateRentalDeposit', () => {
  const items = [
    { id: 'a', deposit: 20 },
    { id: 'b', deposit: 5 },
    { id: 'c', deposit: 0 },
  ];

  it('sums one copy per item by default', () => {
    expect(calculateRentalDeposit(items)).toBe(25);
  });

  it('multiplies by requested copies', () => {
    expect(calculateRentalDeposit(items, { a: 2, b: 3 })).toBe(55);
  });

  it('treats a missing deposit as 0', () => {
    const noDeposit = [{ id: 'x' } as Pick<Item, 'id' | 'deposit'>];
    expect(calculateRentalDeposit(noDeposit)).toBe(0);
  });

  it('is 0 for no items', () => {
    expect(calculateRentalDeposit([])).toBe(0);
  });
});

describe('buildRentalTemplate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const items = [
    { id: 'item1', iid: 1, deposit: 10 },
    { id: 'item2', iid: 2, deposit: 15 },
  ] as Item[];
  const customer = { id: 'cust1', iid: 42 } as Customer;

  it('prefills local dates, deposit, customer and items', () => {
    // Shortly after midnight: a UTC ISO date would still be yesterday in CEST
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 23, 0, 30));

    const template = buildRentalTemplate({ customer, items, remark: 'Hinweis' });

    expect(template.id).toBe('');
    expect(template.rented_on).toBe('2026-09-23');
    expect(template.expected_on).toBe('2026-09-30');
    expect(template.deposit).toBe(25);
    expect(template.customer).toBe('cust1');
    expect(template.items).toEqual(['item1', 'item2']);
    expect(template.expand.items).toBe(items);
    expect(template.expand.customer).toBe(customer);
    expect(template.remark).toBe('Hinweis');
  });

  it('applies the pickup rule to expected_on but keeps rented_on today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const pickup = new Date(2026, 8, 26, 10, 0).toISOString();
    const template = buildRentalTemplate({ items, pickup });

    expect(template.rented_on).toBe('2026-09-23');
    expect(template.expected_on).toBe('2026-10-03');
  });

  it('prefers an explicit expectedOn', () => {
    const template = buildRentalTemplate({
      items,
      pickup: new Date(2026, 8, 26, 10, 0).toISOString(),
      expectedOn: '2026-10-15 00:00:00.000Z',
    });

    expect(template.expected_on).toBe('2026-10-15 00:00:00.000Z');
  });

  it('leaves the customer empty when none is given', () => {
    const template = buildRentalTemplate({ items: [] });

    expect(template.customer).toBe('');
    expect(template.expand.customer).toBeUndefined();
    expect(template.deposit).toBe(0);
    expect(template.remark).toBe('');
  });
});
