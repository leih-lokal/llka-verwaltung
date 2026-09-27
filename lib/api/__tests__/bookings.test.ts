import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus } from '@/types';
import { createBookings, BookingConflictError } from '../bookings';

const bookingsApi = vi.hoisted(() => ({
  getFullList: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/pocketbase/client', () => ({
  collections: { bookings: () => bookingsApi },
  pb: { filter: (expr: string) => expr },
}));

const data = {
  item: 'item1',
  customer: '',
  customer_name: 'Ada Lovelace',
  start_date: '2026-03-05 00:00:00.000Z',
  end_date: '2026-03-08 00:00:00.000Z',
  status: BookingStatus.Reserved,
};

beforeEach(() => {
  vi.resetAllMocks();
  bookingsApi.getFullList.mockResolvedValue([]);
  bookingsApi.delete.mockResolvedValue(true);
});

describe('createBookings', () => {
  it('creates one record per copy, one after another', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let n = 0;
    bookingsApi.create.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
      return { id: `b${++n}` };
    });

    const created = await createBookings(data, 3, 3);
    expect(created.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
    expect(maxInFlight).toBe(1);
  });

  it('refuses a double booking without creating anything', async () => {
    bookingsApi.getFullList.mockResolvedValue([
      { id: 'x', start_date: '2026-03-01 00:00:00.000Z', end_date: '2026-03-05 00:00:00.000Z', status: BookingStatus.Reserved },
    ]);

    await expect(createBookings(data, 1, 1)).rejects.toBeInstanceOf(BookingConflictError);
    expect(bookingsApi.create).not.toHaveBeenCalled();
  });

  it('deletes the records of this attempt when a later create fails', async () => {
    const failure = new Error('network');
    bookingsApi.create
      .mockResolvedValueOnce({ id: 'b1' })
      .mockResolvedValueOnce({ id: 'b2' })
      .mockRejectedValueOnce(failure);

    await expect(createBookings(data, 3, 3)).rejects.toBe(failure);
    expect(bookingsApi.delete.mock.calls.map((c) => c[0]).sort()).toEqual(['b1', 'b2']);
  });

  it('says so when the rollback itself fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    bookingsApi.create.mockResolvedValueOnce({ id: 'b1' }).mockRejectedValueOnce(new Error('network'));
    bookingsApi.delete.mockRejectedValue(new Error('offline'));

    await expect(createBookings(data, 2, 2)).rejects.toThrow(/1 bereits angelegte Buchung/);
  });
});
