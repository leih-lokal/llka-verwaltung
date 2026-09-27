import { describe, it, expect } from 'vitest';
import {
  HIGHLIGHT_COLORS,
  describeHighlightColor,
  getHighlightColorClasses,
  getHighlightColorFilterOptions,
  CUSTOMER_HIGHLIGHT_MEANINGS,
} from '../colors';
import { HighlightColor } from '@/types';

describe('highlight colours', () => {
  it('lists every colour once', () => {
    expect([...HIGHLIGHT_COLORS].sort()).toEqual(Object.values(HighlightColor).sort());
  });

  it('describes a colour by name and meaning', () => {
    expect(describeHighlightColor(HighlightColor.Green, CUSTOMER_HIGHLIGHT_MEANINGS)).toBe(
      'Grün - Teil des Teams'
    );
    expect(describeHighlightColor(HighlightColor.Teal, CUSTOMER_HIGHLIGHT_MEANINGS)).toBe('Türkis');
  });

  it('has classes for stored colours only', () => {
    expect(getHighlightColorClasses('teal')?.rowBorder).toBe('border-b-teal-500');
    expect(getHighlightColorClasses('')).toBeUndefined();
    expect(getHighlightColorClasses('toString')).toBeUndefined();
  });

  it('builds filter options in display order with label overrides', () => {
    const options = getHighlightColorFilterOptions({ [HighlightColor.Green]: 'Grün (Team-Mitglied)' });
    expect(options.map((o) => o.value)).toEqual([...HIGHLIGHT_COLORS]);
    expect(options.find((o) => o.value === HighlightColor.Green)?.label).toBe('Grün (Team-Mitglied)');
    expect(options[0]).toEqual({ value: HighlightColor.Red, label: 'Rot' });
  });
});
