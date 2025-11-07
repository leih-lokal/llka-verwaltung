/**
 * Highlight color constants
 */

import { HighlightColor } from '@/types';

/**
 * Highlight color values (for UI display)
 */
export const HIGHLIGHT_COLOR_VALUES: Record<HighlightColor, string> = {
  [HighlightColor.Green]: '#22c55e',
  [HighlightColor.Blue]: '#3b82f6',
  [HighlightColor.Yellow]: '#eab308',
  [HighlightColor.Red]: '#ef4444',
};

/**
 * Highlight color labels (German)
 */
export const HIGHLIGHT_COLOR_LABELS: Record<HighlightColor, string> = {
  [HighlightColor.Green]: 'Grün',
  [HighlightColor.Blue]: 'Blau',
  [HighlightColor.Yellow]: 'Gelb',
  [HighlightColor.Red]: 'Rot',
};

/**
 * Highlight color options for picker
 */
export const HIGHLIGHT_COLOR_OPTIONS = Object.entries(
  HIGHLIGHT_COLOR_LABELS
).map(([value, label]) => ({
  value: value as HighlightColor,
  label,
  color: HIGHLIGHT_COLOR_VALUES[value as HighlightColor],
}));

/**
 * Get highlight color value
 */
export function getHighlightColor(color?: HighlightColor): string | undefined {
  return color ? HIGHLIGHT_COLOR_VALUES[color] : undefined;
}
