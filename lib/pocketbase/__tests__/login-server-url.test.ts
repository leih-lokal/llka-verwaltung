// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from '../auth';
import { getServerUrl, pb } from '../client';

const OLD_URL = 'https://old.example.org';
const NEW_URL = 'https://new.example.org';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('pocketbase_url', OLD_URL);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  pb.authStore.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('login with a server URL', () => {
  it('sends the attempt to the typed URL but does not persist it when login fails', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { status: 400, message: 'Failed to authenticate.', data: {} })
    );

    const result = await login('admin@example.org', 'wrong', NEW_URL);

    expect(result.success).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(
      new RegExp(`^${NEW_URL}/api/collections/_superusers/auth-with-password`)
    );
    expect(localStorage.getItem('pocketbase_url')).toBe(OLD_URL);
    expect(getServerUrl()).toBe(OLD_URL);
  });

  it('persists the URL once the server accepts the login', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        token: 'token-123',
        record: { id: 'u1', collectionId: '_pbc_superusers', collectionName: '_superusers' },
      })
    );

    const result = await login('admin@example.org', 'secret', NEW_URL);

    expect(result.success).toBe(true);
    expect(localStorage.getItem('pocketbase_url')).toBe(NEW_URL);
    expect(getServerUrl()).toBe(NEW_URL);
    expect(pb.baseURL).toBe(NEW_URL);
  });

  it('rejects non-http(s) URLs without sending anything', async () => {
    const result = await login('admin@example.org', 'secret', 'javascript:alert(1)');

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('pocketbase_url')).toBe(OLD_URL);
  });
});
