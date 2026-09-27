/**
 * Next free user-facing ID (iid) for a collection
 */

/** The slice of a PocketBase RecordService this needs */
export interface IidSource {
  getList<T>(
    page: number,
    perPage: number,
    options?: { sort?: string; fields?: string; skipTotal?: boolean }
  ): Promise<{ items: T[] }>;
}

/**
 * Highest iid + 1, or 1 if the collection is empty.
 *
 * Uses getList rather than getFirstListItem so that only a genuinely empty
 * result means "start at 1". Network, auth and other errors are rethrown:
 * proposing 1 there would suggest an ID that is almost certainly taken.
 */
export async function fetchNextIid(source: IidSource): Promise<number> {
  const result = await source.getList<{ iid: number }>(1, 1, {
    sort: '-iid',
    fields: 'iid',
    skipTotal: true,
  });
  const last = result.items[0]?.iid;
  return typeof last === 'number' ? last + 1 : 1;
}
