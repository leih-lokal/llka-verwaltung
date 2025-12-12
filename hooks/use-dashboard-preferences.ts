/**
 * Dashboard Preferences Hook
 * Manages visibility and collapse state for dashboard components with localStorage persistence
 */
'use client';

import { useState, useEffect } from 'react';

export type DashboardComponent =
  | 'todays-reservations'
  | 'active-rentals'
  | 'dashboard-notes'
  | 'stats-chart'
  | 'overdue-alert'
  | 'due-this-week'
  | 'today-activity';

type ComponentState = Record<DashboardComponent, boolean>;

const VISIBILITY_KEY = 'dashboard_component_visibility';
const COLLAPSED_KEY = 'dashboard_component_collapsed';

const DEFAULT_VISIBILITY: ComponentState = {
  'todays-reservations': true,
  'active-rentals': true,
  'dashboard-notes': true,
  'stats-chart': true,
  'overdue-alert': true,
  'due-this-week': true,
  'today-activity': true,
};

const DEFAULT_COLLAPSED: ComponentState = {
  'todays-reservations': false,
  'active-rentals': false,
  'dashboard-notes': false,
  'stats-chart': false,
  'overdue-alert': false,
  'due-this-week': false,
  'today-activity': false,
};

/**
 * Load state from localStorage with fallback to defaults
 */
function loadState(key: string, defaults: ComponentState): ComponentState {
  if (typeof window === 'undefined') return defaults;

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaults;

    const parsed = JSON.parse(stored);
    // Merge with defaults to handle new components
    return { ...defaults, ...parsed };
  } catch (error) {
    console.error(`Failed to load ${key} from localStorage:`, error);
    return defaults;
  }
}

/**
 * Save state to localStorage
 */
function saveState(key: string, state: ComponentState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.error(`Failed to save ${key} to localStorage:`, error);
  }
}

export interface UseDashboardPreferencesReturn {
  componentVisibility: ComponentState;
  toggleVisibility: (component: DashboardComponent) => void;
  componentCollapsed: ComponentState;
  toggleCollapse: (component: DashboardComponent) => void;
}

/**
 * Hook for managing dashboard component visibility and collapse state
 */
export function useDashboardPreferences(): UseDashboardPreferencesReturn {
  const [componentVisibility, setComponentVisibility] = useState<ComponentState>(
    () => loadState(VISIBILITY_KEY, DEFAULT_VISIBILITY)
  );

  const [componentCollapsed, setComponentCollapsed] = useState<ComponentState>(
    () => loadState(COLLAPSED_KEY, DEFAULT_COLLAPSED)
  );

  // Save visibility changes to localStorage
  useEffect(() => {
    saveState(VISIBILITY_KEY, componentVisibility);
  }, [componentVisibility]);

  // Save collapse changes to localStorage
  useEffect(() => {
    saveState(COLLAPSED_KEY, componentCollapsed);
  }, [componentCollapsed]);

  const toggleVisibility = (component: DashboardComponent) => {
    setComponentVisibility(prev => ({
      ...prev,
      [component]: !prev[component],
    }));
  };

  const toggleCollapse = (component: DashboardComponent) => {
    setComponentCollapsed(prev => ({
      ...prev,
      [component]: !prev[component],
    }));
  };

  return {
    componentVisibility,
    toggleVisibility,
    componentCollapsed,
    toggleCollapse,
  };
}
