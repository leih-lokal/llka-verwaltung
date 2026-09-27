// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupAutoRefresh } from '../auth';
import { pb } from '../client';

const SERVER = 'https://pb.example.org';

/** An unsigned JWT the SDK accepts as valid (only `exp` is checked). */
function fakeToken(label: string): string {
  const b64 = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp, type: 'auth', label })}.sig`;
}

/** A fetch Response whose `url` is set, as a real fetch would. */
function response(status: number, path: string, body: unknown = {}): Response {
  const res = new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  Object.defineProperty(res, 'url', { value: `${SERVER}${path}` });
  return res;
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('pocketbase_url', SERVER);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  pb.authStore.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('401 handling (afterSend)', () => {
  it('clears the session when a regular request is rejected with 401', async () => {
    pb.authStore.save(fakeToken('a'), null);
    fetchMock.mockResolvedValue(
      response(401, '/api/collections/item/records', { status: 401, message: 'x', data: {} })
    );

    await expect(pb.collection('item').getList(1, 1)).rejects.toMatchObject({ status: 401 });
    expect(pb.authStore.token).toBe('');
  });

  it('keeps the session on other errors', async () => {
    const token = fakeToken('a');
    pb.authStore.save(token, null);
    fetchMock.mockResolvedValue(
      response(403, '/api/collections/item/records', { status: 403, message: 'x', data: {} })
    );

    await expect(pb.collection('item').getList(1, 1)).rejects.toMatchObject({ status: 403 });
    expect(pb.authStore.token).toBe(token);
  });

  it('ignores 401s from auth endpoints (e.g. a login attempt)', async () => {
    const token = fakeToken('a');
    pb.authStore.save(token, null);
    fetchMock.mockResolvedValue(
      response(401, '/api/collections/_superusers/auth-with-password', {
        status: 401,
        message: 'x',
        data: {},
      })
    );

    await expect(
      pb.collection('_superusers').authWithPassword('a@example.org', 'pw')
    ).rejects.toMatchObject({ status: 401 });
    expect(pb.authStore.token).toBe(token);
  });

  it('does not drop a newer session because of a 401 for an older token', async () => {
    pb.authStore.save(fakeToken('old'), null);
    let respond!: (res: Response) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => (respond = resolve)));

    const request = pb.collection('item').getList(1, 1);
    // Someone logs in again while the request is in flight
    const fresh = fakeToken('new');
    pb.authStore.save(fresh, null);
    respond(response(401, '/api/collections/item/records', { status: 401, message: 'x', data: {} }));

    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(pb.authStore.token).toBe(fresh);
  });
});

describe('setupAutoRefresh', () => {
  it('shares one refresh interval between all callers', async () => {
    vi.useFakeTimers();
    pb.authStore.save(fakeToken('a'), null);
    fetchMock.mockImplementation(async () =>
      response(200, '/api/collections/_superusers/auth-refresh', {
        token: fakeToken('refreshed'),
        record: { id: 'u1', collectionName: '_superusers' },
      })
    );

    const releases = [setupAutoRefresh(), setupAutoRefresh(), setupAutoRefresh()];
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    releases[0]();
    releases[0](); // releasing twice must not drop another caller's reference
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    releases[1]();
    releases[2]();
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
