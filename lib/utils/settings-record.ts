/**
 * Maps the PocketBase settings record to app settings, falling back to the
 * defaults for fields that are missing (older records/collections) or
 * malformed.
 */

import {
  DEFAULT_SETTINGS,
  type ImageCompressionSettings,
  type ImageOutputFormat,
  type Settings,
} from '@/types';

const OUTPUT_FORMATS: readonly ImageOutputFormat[] = ['keep', 'webp', 'jpeg'];

export type AppSettings = Omit<Settings, 'id' | 'created' | 'updated'>;

/**
 * Key-by-key merge of a JSON settings group over its defaults. Stored values
 * are kept only when they have the default's type; unknown keys are dropped.
 */
export function mergeWithDefaults<T extends object>(defaults: T, value: unknown): T {
  const merged = { ...defaults };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return merged;

  const stored = value as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const v = stored[key];
    const sameType = v !== null && typeof v === typeof defaults[key];
    if (sameType && (typeof v !== 'number' || Number.isFinite(v))) {
      merged[key] = v as T[typeof key];
    }
  }
  return merged;
}

/**
 * opening_hours as a list of [day, open, close] string triples. Records
 * created before the field existed hold null: use the default hours then.
 * Malformed entries are dropped.
 */
export function toOpeningHours(value: unknown): Settings['opening_hours'] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.opening_hours;
  return value
    .filter(
      (entry): entry is [string, string, string] =>
        Array.isArray(entry) &&
        entry.length >= 3 &&
        entry.slice(0, 3).every((part) => typeof part === 'string')
    )
    .map(([day, open, close]) => [day, open, close]);
}

/**
 * image_compression merged key by key over the defaults
 */
function toImageCompression(value: unknown): ImageCompressionSettings {
  const merged = mergeWithDefaults(DEFAULT_SETTINGS.image_compression, value);
  if (!OUTPUT_FORMATS.includes(merged.output_format)) {
    merged.output_format = DEFAULT_SETTINGS.image_compression.output_format;
  }
  return merged;
}

/**
 * App settings from the settings record, or the defaults without one
 */
export function settingsFromRecord(record: Partial<Settings> | null | undefined): AppSettings {
  if (!record) return DEFAULT_SETTINGS;

  return {
    ...DEFAULT_SETTINGS,
    app_name: record.app_name ?? DEFAULT_SETTINGS.app_name,
    tagline: record.tagline ?? DEFAULT_SETTINGS.tagline,
    logo: record.logo,
    favicon: record.favicon,
    copyright_holder: record.copyright_holder ?? DEFAULT_SETTINGS.copyright_holder,
    show_powered_by: record.show_powered_by ?? DEFAULT_SETTINGS.show_powered_by,
    primary_color: record.primary_color ?? DEFAULT_SETTINGS.primary_color,
    id_format: record.id_format ?? DEFAULT_SETTINGS.id_format,
    id_padding: record.id_padding ?? DEFAULT_SETTINGS.id_padding,
    reservations_enabled: record.reservations_enabled ?? DEFAULT_SETTINGS.reservations_enabled,
    setup_complete: record.setup_complete ?? DEFAULT_SETTINGS.setup_complete,
    opening_hours: toOpeningHours(record.opening_hours),
    image_compression: toImageCompression(record.image_compression),
  };
}
