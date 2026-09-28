// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IdentityProvider, useIdentity } from '../use-identity';

const HOUR = 60 * 60 * 1000;

function wrapper({ children }: { children: ReactNode }) {
  return <IdentityProvider>{children}</IdentityProvider>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-15T08:00:00Z'));
  localStorage.clear();
  localStorage.setItem(
    'current_employee_name',
    JSON.stringify({ value: 'AB', timestamp: Date.now() })
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('IdentityProvider expiry', () => {
  it('loads a fresh identity on mount', () => {
    const { result } = renderHook(() => useIdentity(), { wrapper });
    expect(result.current.currentIdentity).toBe('AB');
  });

  it('drops an expired identity when the window regains focus', () => {
    const { result } = renderHook(() => useIdentity(), { wrapper });

    act(() => {
      vi.setSystemTime(Date.now() + 13 * HOUR); // overnight
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current.currentIdentity).toBeNull();
    expect(localStorage.getItem('current_employee_name')).toBeNull();
  });

  it('keeps the identity within the 12 hours', () => {
    const { result } = renderHook(() => useIdentity(), { wrapper });

    act(() => {
      vi.setSystemTime(Date.now() + 11 * HOUR);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.currentIdentity).toBe('AB');
  });

  it('expires in a window that never loses focus', () => {
    const { result } = renderHook(() => useIdentity(), { wrapper });

    act(() => {
      vi.advanceTimersByTime(12 * HOUR + 60 * 1000);
    });

    expect(result.current.currentIdentity).toBeNull();
  });
});
