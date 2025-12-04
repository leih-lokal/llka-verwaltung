/**
 * Centralized keyboard shortcut registry
 * Defines all Linear-style sequential shortcuts
 */

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export type ShortcutCategory = 'create' | 'open' | 'goto' | 'view';

export interface ShortcutDefinition {
  sequence: [string, string]; // First key, second key
  description: string;
  category: ShortcutCategory;
  handler: (context: ShortcutContext) => void;
}

export interface ShortcutContext {
  router: AppRouterInstance;
  setCommandMenuOpen: (open: boolean) => void;
  setQuickFindOpen: (open: boolean) => void;
  setSequentialModeOpen: (open: boolean) => void;
  setIdentityPickerOpen: (open: boolean) => void;
}

/**
 * Shortcut registry organized by first key for O(1) lookup
 *
 * Total: 19 shortcuts
 * - N: 4 (create)
 * - O: 3 (open)
 * - G: 6 (goto)
 * - V: 5 (view)
 */
export const SHORTCUT_REGISTRY: Record<string, ShortcutDefinition[]> = {
  // N - New/Create shortcuts (4)
  n: [
    {
      sequence: ['n', 'n'],
      description: 'Neuer Nutzer',
      category: 'create',
      handler: ({ router }) => router.push('/customers?action=new'),
    },
    {
      sequence: ['n', 'g'],
      description: 'Neuer Gegenstand',
      category: 'create',
      handler: ({ router }) => router.push('/items?action=new'),
    },
    {
      sequence: ['n', 'l'],
      description: 'Neuer Leihvorgang',
      category: 'create',
      handler: ({ router }) => router.push('/rentals?action=new'),
    },
    {
      sequence: ['n', 'r'],
      description: 'Neue Reservierung',
      category: 'create',
      handler: ({ router }) => router.push('/reservations?action=new'),
    },
  ],

  // O - Open modals (3)
  o: [
    {
      sequence: ['o', 's'],
      description: 'Suche öffnen',
      category: 'open',
      handler: ({ setCommandMenuOpen }) => setCommandMenuOpen(true),
    },
    {
      sequence: ['o', 'f'],
      description: 'Finden öffnen',
      category: 'open',
      handler: ({ setQuickFindOpen }) => setQuickFindOpen(true),
    },
    {
      sequence: ['o', 'o'],
      description: 'Sequenzmodus öffnen',
      category: 'open',
      handler: ({ setSequentialModeOpen }) => setSequentialModeOpen(true),
    },
  ],

  // G - Go to features (6)
  g: [
    {
      sequence: ['g', 'o'],
      description: 'Überfällige Ausleihen',
      category: 'goto',
      handler: ({ router }) => router.push('/overdue'),
    },
    {
      sequence: ['g', 'i'],
      description: 'Inventaranalyse',
      category: 'goto',
      handler: ({ router }) => router.push('/items/analytics'),
    },
    {
      sequence: ['g', 's'],
      description: 'Systemcheck',
      category: 'goto',
      handler: ({ router }) => router.push('/system-check'),
    },
    {
      sequence: ['g', 'p'],
      description: 'Label Designer',
      category: 'goto',
      handler: ({ router }) => router.push('/label-designer'),
    },
    {
      sequence: ['g', 'l'],
      description: 'Logs',
      category: 'goto',
      handler: ({ router }) => router.push('/logs'),
    },
    {
      sequence: ['g', 'w'],
      description: 'Identitätswahl',
      category: 'goto',
      handler: ({ setIdentityPickerOpen }) => setIdentityPickerOpen(true),
    },
  ],

  // V - View/Navigate pages (5)
  v: [
    {
      sequence: ['v', 'd'],
      description: 'Dashboard',
      category: 'view',
      handler: ({ router }) => router.push('/dashboard'),
    },
    {
      sequence: ['v', 'n'],
      description: 'Nutzer:innen',
      category: 'view',
      handler: ({ router }) => router.push('/customers'),
    },
    {
      sequence: ['v', 'g'],
      description: 'Gegenstände',
      category: 'view',
      handler: ({ router }) => router.push('/items'),
    },
    {
      sequence: ['v', 'l'],
      description: 'Leihvorgänge',
      category: 'view',
      handler: ({ router }) => router.push('/rentals'),
    },
    {
      sequence: ['v', 'r'],
      description: 'Reservierungen',
      category: 'view',
      handler: ({ router }) => router.push('/reservations'),
    },
  ],
};

/**
 * Get all available shortcuts as a flat array
 */
export function getAllShortcuts(): ShortcutDefinition[] {
  return Object.values(SHORTCUT_REGISTRY).flat();
}

/**
 * Get shortcuts for a specific first key
 */
export function getShortcutsForKey(firstKey: string): ShortcutDefinition[] {
  return SHORTCUT_REGISTRY[firstKey.toLowerCase()] || [];
}
