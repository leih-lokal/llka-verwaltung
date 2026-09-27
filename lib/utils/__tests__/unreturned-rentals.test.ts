import { describe, it, expect } from 'vitest';
import { removeRental, upsertUnreturnedRental } from '../unreturned-rentals';

function rental(id: string, expectedDay: string, returnedOn = '') {
  return { id, expected_on: `${expectedDay} 00:00:00.000Z`, returned_on: returnedOn };
}

describe('upsertUnreturnedRental', () => {
  const list = [rental('a', '2026-04-01'), rental('b', '2026-04-05')];

  it('inserts a new unreturned rental in expected_on order', () => {
    const next = upsertUnreturnedRental(list, rental('c', '2026-04-03'));
    expect(next.map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('replaces an existing rental and re-sorts it when its due date moved', () => {
    const next = upsertUnreturnedRental(list, rental('a', '2026-04-10'));
    expect(next.map((r) => r.id)).toEqual(['b', 'a']);
    expect(next[1].expected_on).toBe('2026-04-10 00:00:00.000Z');
  });

  it('inserts an updated rental that was not listed (e.g. a return was undone)', () => {
    const next = upsertUnreturnedRental([rental('b', '2026-04-05')], rental('a', '2026-04-01'));
    expect(next.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('drops a rental once it is returned', () => {
    const next = upsertUnreturnedRental(list, rental('a', '2026-04-01', '2026-04-02 00:00:00.000Z'));
    expect(next.map((r) => r.id)).toEqual(['b']);
  });

  it('does not insert a returned rental', () => {
    const next = upsertUnreturnedRental(list, rental('c', '2026-04-01', '2026-04-02 00:00:00.000Z'));
    expect(next).toBe(list);
  });
});

describe('removeRental', () => {
  it('removes by id and keeps the array when nothing matched', () => {
    const list = [rental('a', '2026-04-01'), rental('b', '2026-04-05')];
    expect(removeRental(list, 'a').map((r) => r.id)).toEqual(['b']);
    expect(removeRental(list, 'x')).toBe(list);
  });
});
