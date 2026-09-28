/**
 * Per-browser preference for single-key keyboard shortcuts.
 *
 * Every global shortcut in the app is an unmodified key (letter sequences,
 * "/", double Shift). WCAG 2.1.4 asks for a way to turn such shortcuts off,
 * since speech input or stray key presses can trigger them by accident.
 */

const STORAGE_KEY = 'keyboard_shortcuts_single_key_enabled';

/** Last known value; null = not read from storage yet. */
let cachedEnabled: boolean | null = null;
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    // Storage unavailable (private mode, blocked site data): default on
    return true;
  }
}

/**
 * Whether single-key shortcuts are enabled (default: true).
 */
export function areSingleKeyShortcutsEnabled(): boolean {
  if (cachedEnabled === null) {
    cachedEnabled = typeof window === 'undefined' ? true : readStored();
  }
  return cachedEnabled;
}

/**
 * Enable or disable single-key shortcuts. Persisted in localStorage when
 * available; otherwise the choice holds for the rest of the session.
 */
export function setSingleKeyShortcutsEnabled(enabled: boolean): void {
  cachedEnabled = enabled;
  try {
    if (enabled) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, 'false');
    }
  } catch {
    // Keep the in-memory value
  }
  listeners.forEach((listener) => listener());
}

/**
 * Subscribe to changes (this tab and, via the storage event, other tabs).
 * Shaped for useSyncExternalStore.
 */
export function subscribeSingleKeyShortcuts(listener: () => void): () => void {
  listeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    // key is null when storage was cleared
    if (event.key === STORAGE_KEY || event.key === null) {
      cachedEnabled = null;
      listener();
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}
