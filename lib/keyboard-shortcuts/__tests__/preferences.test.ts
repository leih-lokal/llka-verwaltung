// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'keyboard_shortcuts_single_key_enabled';

// The module caches the value, so load a fresh copy per test
async function load() {
  vi.resetModules();
  return import('../preferences');
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('single-key shortcut preference', () => {
  it('defaults to enabled', async () => {
    const prefs = await load();
    expect(prefs.areSingleKeyShortcutsEnabled()).toBe(true);
  });

  it('persists a disabled choice and notifies subscribers', async () => {
    const prefs = await load();
    const listener = vi.fn();
    const unsubscribe = prefs.subscribeSingleKeyShortcuts(listener);

    prefs.setSingleKeyShortcutsEnabled(false);
    expect(prefs.areSingleKeyShortcutsEnabled()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    prefs.setSingleKeyShortcutsEnabled(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    // A fresh page load reads the stored value
    localStorage.setItem(STORAGE_KEY, 'false');
    expect((await load()).areSingleKeyShortcutsEnabled()).toBe(false);
  });

  it('keeps working in memory when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const prefs = await load();
    expect(prefs.areSingleKeyShortcutsEnabled()).toBe(true);
    prefs.setSingleKeyShortcutsEnabled(false);
    expect(prefs.areSingleKeyShortcutsEnabled()).toBe(false);
  });
});
