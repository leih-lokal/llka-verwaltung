import { describe, it, expect } from 'vitest';
import { mergeWithDefaults, settingsFromRecord, toOpeningHours } from '../settings-record';
import { DEFAULT_SETTINGS, type Settings } from '@/types';

function record(overrides: Record<string, unknown>): Settings {
  return {
    id: 's1',
    created: '',
    updated: '',
    ...DEFAULT_SETTINGS,
    ...overrides,
  } as Settings;
}

describe('settingsFromRecord', () => {
  it('returns the defaults without a record', () => {
    expect(settingsFromRecord(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('takes the stored values, including empty/false/0', () => {
    const settings = settingsFromRecord(
      record({ app_name: 'Leihladen', tagline: '', show_powered_by: false, id_padding: 0 })
    );
    expect(settings.app_name).toBe('Leihladen');
    expect(settings.tagline).toBe('');
    expect(settings.show_powered_by).toBe(false);
    expect(settings.id_padding).toBe(0);
  });

  it('falls back to defaults for fields missing from older collections', () => {
    const settings = settingsFromRecord(
      record({ reservations_enabled: undefined, opening_hours: undefined, image_compression: undefined })
    );
    expect(settings.reservations_enabled).toBe(DEFAULT_SETTINGS.reservations_enabled);
    expect(settings.opening_hours).toEqual(DEFAULT_SETTINGS.opening_hours);
    expect(settings.image_compression).toEqual(DEFAULT_SETTINGS.image_compression);
  });

  it('uses the default opening hours for records that hold null', () => {
    expect(settingsFromRecord(record({ opening_hours: null })).opening_hours).toEqual(
      DEFAULT_SETTINGS.opening_hours
    );
  });

  it('merges image_compression key by key', () => {
    const settings = settingsFromRecord(
      record({ image_compression: { quality: 60, output_format: 'webp' } })
    );
    expect(settings.image_compression).toEqual({
      ...DEFAULT_SETTINGS.image_compression,
      quality: 60,
      output_format: 'webp',
    });
  });

  it('replaces an unknown output format with the default', () => {
    const settings = settingsFromRecord(record({ image_compression: { output_format: 'png' } }));
    expect(settings.image_compression.output_format).toBe('keep');
  });
});

describe('mergeWithDefaults', () => {
  const defaults = { enabled: true, size: 10, label: 'x' };

  it('ignores values of the wrong type, NaN and unknown keys', () => {
    expect(
      mergeWithDefaults(defaults, { enabled: 'yes', size: Number.NaN, label: 'y', extra: 1 })
    ).toEqual({ enabled: true, size: 10, label: 'y' });
  });

  it('returns a copy of the defaults for non-objects', () => {
    for (const value of [null, undefined, 'x', 3, [1, 2]]) {
      const merged = mergeWithDefaults(defaults, value);
      expect(merged).toEqual(defaults);
      expect(merged).not.toBe(defaults);
    }
  });
});

describe('toOpeningHours', () => {
  it('keeps valid [day, open, close] triples and drops malformed entries', () => {
    expect(
      toOpeningHours([['mon', '10:00', '12:00'], ['tue', '10:00'], 'wed', ['thu', 1, 2], null])
    ).toEqual([['mon', '10:00', '12:00']]);
  });

  it('keeps an empty list (closed every day)', () => {
    expect(toOpeningHours([])).toEqual([]);
  });
});
