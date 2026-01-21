/**
 * Global settings context for white-label configuration
 * Provides app-wide access to branding, theming, and feature settings
 */

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { pb, collections } from '@/lib/pocketbase/client';
import { Settings, DEFAULT_SETTINGS } from '@/types';
import { toast } from 'sonner';

interface SettingsContextType {
  /** Current settings (merged with defaults) */
  settings: Omit<Settings, 'id' | 'created' | 'updated'>;

  /** Raw settings record from PocketBase (null if none exists) */
  rawSettings: Settings | null;

  /** Whether settings are currently loading */
  isLoading: boolean;

  /** Whether settings have been loaded at least once */
  isLoaded: boolean;

  /** Whether the settings collection exists in PocketBase */
  collectionExists: boolean;

  /** Update settings in PocketBase */
  updateSettings: (
    data: Partial<Omit<Settings, 'id' | 'created' | 'updated'>>
  ) => Promise<boolean>;

  /** Refresh settings from PocketBase */
  refreshSettings: () => Promise<void>;

  /** Get the full URL for a settings file (logo, favicon) */
  getFileUrl: (filename: string | undefined) => string | null;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

/**
 * Apply primary color to CSS custom properties
 * Note: Only applies to primary/accent/ring - destructive and border
 * retain their semantic meanings (red for destructive, neutral for border)
 */
function applyPrimaryColor(color: string) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Set primary color and related variables
  // Intentionally NOT setting --destructive (should stay red for delete actions)
  // Intentionally NOT setting --border (should stay neutral)
  root.style.setProperty('--primary', color);
  root.style.setProperty('--accent', color);
  root.style.setProperty('--ring', color);
  root.style.setProperty('--chart-1', color);
  root.style.setProperty('--sidebar-primary', color);
  root.style.setProperty('--sidebar-ring', color);
}

/**
 * Update document title based on settings
 */
function updateDocumentTitle(appName: string, tagline?: string) {
  if (typeof document === 'undefined') return;
  document.title = tagline ? `${appName} - ${tagline}` : appName;
}

/**
 * Update favicon link in document head
 */
function updateFavicon(faviconUrl: string | null) {
  if (typeof document === 'undefined') return;

  // Find or create the favicon link element
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }

  // Set the favicon URL (use default if none provided)
  link.href = faviconUrl || '/favicon.ico';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [rawSettings, setRawSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [collectionExists, setCollectionExists] = useState(true);

  // Merge raw settings with defaults
  const settings: Omit<Settings, 'id' | 'created' | 'updated'> = {
    ...DEFAULT_SETTINGS,
    ...(rawSettings
      ? {
          app_name: rawSettings.app_name,
          tagline: rawSettings.tagline,
          logo: rawSettings.logo,
          favicon: rawSettings.favicon,
          copyright_holder: rawSettings.copyright_holder,
          show_powered_by: rawSettings.show_powered_by,
          primary_color: rawSettings.primary_color,
          id_format: rawSettings.id_format,
          id_padding: rawSettings.id_padding,
          reservations_enabled: rawSettings.reservations_enabled,
          setup_complete: rawSettings.setup_complete,
        }
      : {}),
  };

  // Load settings from PocketBase
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);

      // Try to get the first (and only) settings record
      const result = await collections.settings().getList<Settings>(1, 1);

      setCollectionExists(true);
      if (result.items.length > 0) {
        setRawSettings(result.items[0]);
      } else {
        setRawSettings(null);
      }
    } catch (error: unknown) {
      // Check if the error is because the collection doesn't exist
      const pbError = error as { status?: number; message?: string };
      const isCollectionNotFound =
        pbError.status === 404 ||
        pbError.message?.toLowerCase().includes('not found') ||
        pbError.message?.toLowerCase().includes('collection');

      if (isCollectionNotFound) {
        console.warn('Settings collection does not exist in PocketBase');
        setCollectionExists(false);
      } else {
        // Other errors - collection might exist but have access issues
        console.warn('Could not load settings, using defaults:', error);
        setCollectionExists(true);
      }
      setRawSettings(null);
    } finally {
      setIsLoading(false);
      setIsLoaded(true);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Apply theming when settings change
  useEffect(() => {
    if (settings.primary_color) {
      applyPrimaryColor(settings.primary_color);
    }
  }, [settings.primary_color]);

  // Update document title when settings change
  useEffect(() => {
    updateDocumentTitle(settings.app_name, settings.tagline);
  }, [settings.app_name, settings.tagline]);

  // Update favicon when settings change
  useEffect(() => {
    const faviconUrl = settings.favicon && rawSettings
      ? pb.files.getUrl(rawSettings, settings.favicon)
      : null;
    updateFavicon(faviconUrl);
  }, [settings.favicon, rawSettings]);

  // Get file URL for uploaded files
  const getFileUrl = useCallback(
    (filename: string | undefined): string | null => {
      if (!filename || !rawSettings) return null;

      return pb.files.getUrl(rawSettings, filename);
    },
    [rawSettings]
  );

  // Update settings
  const updateSettings = useCallback(
    async (
      data: Partial<Omit<Settings, 'id' | 'created' | 'updated'>>
    ): Promise<boolean> => {
      try {
        if (rawSettings) {
          // Update existing record
          const updated = await collections
            .settings()
            .update<Settings>(rawSettings.id, data);
          setRawSettings(updated);
        } else {
          // Create new record
          const created = await collections.settings().create<Settings>({
            ...DEFAULT_SETTINGS,
            ...data,
          });
          setRawSettings(created);
        }
        return true;
      } catch (error) {
        console.error('Failed to update settings:', error);
        toast.error('Einstellungen konnten nicht gespeichert werden');
        return false;
      }
    },
    [rawSettings]
  );

  // Refresh settings
  const refreshSettings = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        rawSettings,
        isLoading,
        isLoaded,
        collectionExists,
        updateSettings,
        refreshSettings,
        getFileUrl,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

/**
 * Hook to fetch settings without requiring provider (for login page)
 * Returns settings or defaults, handles loading state
 */
export function usePublicSettings() {
  const [settings, setSettings] =
    useState<Omit<Settings, 'id' | 'created' | 'updated'>>(DEFAULT_SETTINGS);
  const [rawSettings, setRawSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPublicSettings() {
      try {
        // Fetch settings without requiring auth (public read access)
        const result = await collections.settings().getList<Settings>(1, 1);

        if (result.items.length > 0) {
          const record = result.items[0];
          setRawSettings(record);
          setSettings({
            ...DEFAULT_SETTINGS,
            app_name: record.app_name,
            tagline: record.tagline,
            logo: record.logo,
            favicon: record.favicon,
            copyright_holder: record.copyright_holder,
            show_powered_by: record.show_powered_by,
            primary_color: record.primary_color,
            id_format: record.id_format,
            id_padding: record.id_padding,
            reservations_enabled: record.reservations_enabled,
            setup_complete: record.setup_complete,
          });
        }
      } catch (error) {
        // Settings might not exist or be inaccessible, use defaults
        console.warn('Could not load public settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPublicSettings();
  }, []);

  // Get file URL helper
  const getFileUrl = useCallback(
    (filename: string | undefined): string | null => {
      if (!filename || !rawSettings) return null;
      return pb.files.getUrl(rawSettings, filename);
    },
    [rawSettings]
  );

  return { settings, rawSettings, isLoading, getFileUrl };
}
