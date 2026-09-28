// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearStatsCache, fetchStats } from '../stats';

const mocks = vi.hoisted(() => ({
  serverUrl: 'https://a.example',
  send: vi.fn(),
}));

vi.mock('@/lib/pocketbase/client', () => ({
  pb: { send: mocks.send },
  getServerUrl: () => mocks.serverUrl,
}));

function stats(n: number) {
  return {
    new_customers_count: { '2026-04': n },
    active_customers_count: {},
    rentals_count: {},
    total_items: {},
  };
}

beforeEach(() => {
  localStorage.clear();
  mocks.send.mockReset();
  mocks.serverUrl = 'https://a.example';
});

describe('fetchStats cache', () => {
  it('serves cached stats for the same server', async () => {
    mocks.send.mockResolvedValueOnce(stats(1));
    await fetchStats();
    expect(await fetchStats()).toEqual(stats(1));
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("doesn't serve another server's cached stats", async () => {
    mocks.send.mockResolvedValueOnce(stats(1)).mockResolvedValueOnce(stats(2));
    await fetchStats();

    mocks.serverUrl = 'https://b.example';
    expect(await fetchStats()).toEqual(stats(2));
    expect(mocks.send).toHaveBeenCalledTimes(2);

    // Switching back finds server A's entry again
    mocks.serverUrl = 'https://a.example';
    expect(await fetchStats()).toEqual(stats(1));
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it('caches a response under the server it was requested from', async () => {
    mocks.send.mockImplementationOnce(async () => {
      mocks.serverUrl = 'https://b.example'; // URL changes mid-request
      return stats(1);
    });
    await fetchStats();

    mocks.send.mockResolvedValueOnce(stats(2));
    expect(await fetchStats()).toEqual(stats(2));
  });

  it('clearStatsCache forces a refetch', async () => {
    mocks.send.mockResolvedValueOnce(stats(1)).mockResolvedValueOnce(stats(2));
    await fetchStats();
    clearStatsCache();
    expect(await fetchStats()).toEqual(stats(2));
  });
});
