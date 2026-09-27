import { describe, it, expect, vi } from 'vitest';
import { fetchNextIid, type IidSource } from '../next-iid';

function sourceReturning(items: { iid: number }[]): IidSource {
  return { getList: vi.fn().mockResolvedValue({ items }) } as unknown as IidSource;
}

describe('fetchNextIid', () => {
  it('returns the highest iid + 1', async () => {
    await expect(fetchNextIid(sourceReturning([{ iid: 451 }]))).resolves.toBe(452);
  });

  it('returns 1 for an empty collection', async () => {
    await expect(fetchNextIid(sourceReturning([]))).resolves.toBe(1);
  });

  it('asks for the single highest iid', async () => {
    const source = sourceReturning([{ iid: 7 }]);
    await fetchNextIid(source);
    expect(source.getList).toHaveBeenCalledWith(1, 1, expect.objectContaining({ sort: '-iid' }));
  });

  it('rethrows lookup errors instead of falling back to 1', async () => {
    const error = Object.assign(new Error('Failed to fetch'), { status: 0 });
    const source = { getList: vi.fn().mockRejectedValue(error) } as unknown as IidSource;
    await expect(fetchNextIid(source)).rejects.toBe(error);
  });
});
