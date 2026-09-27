import { describe, it, expect } from 'vitest';
import { buildPartialReturnUpdate } from '../partial-return-update';
import type { Rental } from '@/types';

function rental(overrides: Partial<Rental> = {}): Rental {
  return {
    id: 'r1',
    created: '',
    updated: '',
    customer: 'c1',
    items: ['a', 'b'],
    requested_copies: { a: 3, b: 1 },
    deposit: 40,
    deposit_back: 0,
    rented_on: '2026-09-01 00:00:00.000Z',
    expected_on: '2026-09-08 00:00:00.000Z',
    ...overrides,
  };
}

describe('buildPartialReturnUpdate', () => {
  it('records a first partial return', () => {
    expect(buildPartialReturnUpdate(rental(), { a: 1 }, 10)).toEqual({
      returned_items: { a: 1 },
      deposit_back: 10,
      isFullyReturned: false,
    });
  });

  it('adds to the stored returns and deposit instead of replacing them', () => {
    const latest = rental({ returned_items: { a: 1 }, deposit_back: 10 });
    expect(buildPartialReturnUpdate(latest, { a: 1, b: 1 }, 15)).toEqual({
      returned_items: { a: 2, b: 1 },
      deposit_back: 25,
      isFullyReturned: false,
    });
  });

  it('detects when the return completes the rental', () => {
    const latest = rental({ returned_items: { a: 2 }, deposit_back: 10 });
    const update = buildPartialReturnUpdate(latest, { a: 1, b: 1 }, 30);
    expect(update.returned_items).toEqual({ a: 3, b: 1 });
    expect(update.isFullyReturned).toBe(true);
  });

  it('treats items without a requested count as one copy', () => {
    const latest = rental({ items: ['a'], requested_copies: {} });
    expect(buildPartialReturnUpdate(latest, { a: 1 }, 0).isFullyReturned).toBe(true);
  });

  it('caps returns at the copies still out', () => {
    // e.g. another return was recorded after the dialog was opened
    const latest = rental({ returned_items: { a: 2 } });
    expect(buildPartialReturnUpdate(latest, { a: 3 }, 0).returned_items).toEqual({ a: 3 });
  });

  it('ignores items that are no longer part of the rental', () => {
    expect(buildPartialReturnUpdate(rental(), { x: 1 }, 0).returned_items).toEqual({});
  });

  it('handles a missing deposit_back', () => {
    const latest = rental({ deposit_back: undefined as unknown as number });
    expect(buildPartialReturnUpdate(latest, { b: 1 }, 5).deposit_back).toBe(5);
  });
});
