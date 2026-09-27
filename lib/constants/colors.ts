/**
 * Highlight colours of customers and items: the one place for their German
 * names, what they mean, and their Tailwind classes. The form help texts in
 * lib/constants/documentation.ts list the meanings from here.
 */

import { HighlightColor } from '@/types';

/** All highlight colours in display order (picker, filters, help texts) */
export const HIGHLIGHT_COLORS: readonly HighlightColor[] = [
  HighlightColor.Red,
  HighlightColor.Orange,
  HighlightColor.Yellow,
  HighlightColor.Green,
  HighlightColor.Teal,
  HighlightColor.Blue,
  HighlightColor.Purple,
  HighlightColor.Pink,
];

/**
 * Highlight color labels (German)
 */
export const HIGHLIGHT_COLOR_LABELS: Record<HighlightColor, string> = {
  [HighlightColor.Green]: 'Grün',
  [HighlightColor.Blue]: 'Blau',
  [HighlightColor.Yellow]: 'Gelb',
  [HighlightColor.Red]: 'Rot',
  [HighlightColor.Purple]: 'Lila',
  [HighlightColor.Orange]: 'Orange',
  [HighlightColor.Pink]: 'Rosa',
  [HighlightColor.Teal]: 'Türkis',
};

/**
 * What a colour means on a customer. Only these four have an agreed
 * meaning; the others are announced by name only.
 */
export const CUSTOMER_HIGHLIGHT_MEANINGS: Partial<Record<HighlightColor, string>> = {
  [HighlightColor.Red]: 'Aktiver Problemnutzer, keine Ausleihen möglich',
  [HighlightColor.Yellow]: 'Fehlende Informationen wie Telefonnummer oder Ausweis',
  [HighlightColor.Green]: 'Teil des Teams',
  [HighlightColor.Blue]: 'Noch nicht zum Newsletter hinzugefügt',
};

/** What a colour means on an item */
export const ITEM_HIGHLIGHT_MEANINGS: Record<HighlightColor, string> = {
  [HighlightColor.Red]: 'Problematischer Artikel (häufig defekt, Verlustrisiko)',
  [HighlightColor.Orange]: 'Auslaufender Artikel',
  [HighlightColor.Yellow]: 'Artikel mit besonderen Hinweisen',
  [HighlightColor.Green]: 'Besonders beliebter Artikel, VIP-Artikel',
  [HighlightColor.Blue]: 'Neuanschaffung, wertvoller Artikel',
  [HighlightColor.Teal]: 'Team-Favorit',
  [HighlightColor.Pink]: 'Saisonaler Artikel',
  [HighlightColor.Purple]: 'Artikel für spezielle Veranstaltungen',
};

/** "Rot - <meaning>", or just the name if the colour has no meaning */
export function describeHighlightColor(
  color: HighlightColor,
  meanings: Partial<Record<HighlightColor, string>>
): string {
  const label = HIGHLIGHT_COLOR_LABELS[color] ?? color;
  const meaning = meanings[color];
  return meaning ? `${label} - ${meaning}` : label;
}

/** Filter options for a highlight colour field, in display order */
export function getHighlightColorFilterOptions(
  labels: Partial<Record<HighlightColor, string>> = {}
): { value: HighlightColor; label: string }[] {
  return HIGHLIGHT_COLORS.map((color) => ({
    value: color,
    label: labels[color] ?? HIGHLIGHT_COLOR_LABELS[color],
  }));
}

/** Tailwind classes for one highlight colour */
export interface HighlightColorClasses {
  /** Solid fill: list and filter dots, badges */
  solid: string;
  /** Bottom border colour of a highlighted list row */
  rowBorder: string;
  /** Tinted box with a matching border (customer sheet notes) */
  callout: string;
  /** Picker swatch background */
  swatch: string;
  /** Picker swatch border when selected */
  swatchChecked: string;
  /** Picker swatch border when not selected */
  swatchUnchecked: string;
}

// Class names are spelled out in full so Tailwind finds them.
export const HIGHLIGHT_COLOR_CLASSES: Record<HighlightColor, HighlightColorClasses> = {
  [HighlightColor.Red]: {
    solid: 'bg-red-500',
    rowBorder: 'border-b-red-500',
    callout: 'bg-red-50 dark:bg-red-950/20 border-red-500',
    swatch: 'bg-red-100 dark:bg-red-950/30',
    swatchChecked: 'border-red-500 ring-2 ring-red-500/20 scale-105',
    swatchUnchecked: 'border-red-300 dark:border-red-800 hover:border-red-500',
  },
  [HighlightColor.Orange]: {
    solid: 'bg-orange-500',
    rowBorder: 'border-b-orange-500',
    callout: 'bg-orange-50 dark:bg-orange-950/20 border-orange-500',
    swatch: 'bg-orange-100 dark:bg-orange-950/30',
    swatchChecked: 'border-orange-500 ring-2 ring-orange-500/20 scale-105',
    swatchUnchecked: 'border-orange-300 dark:border-orange-800 hover:border-orange-500',
  },
  [HighlightColor.Yellow]: {
    solid: 'bg-yellow-500',
    rowBorder: 'border-b-yellow-500',
    callout: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500',
    swatch: 'bg-yellow-100 dark:bg-yellow-950/30',
    swatchChecked: 'border-yellow-500 ring-2 ring-yellow-500/20 scale-105',
    swatchUnchecked: 'border-yellow-300 dark:border-yellow-800 hover:border-yellow-500',
  },
  [HighlightColor.Green]: {
    solid: 'bg-green-500',
    rowBorder: 'border-b-green-500',
    callout: 'bg-green-50 dark:bg-green-950/20 border-green-500',
    swatch: 'bg-green-100 dark:bg-green-950/30',
    swatchChecked: 'border-green-500 ring-2 ring-green-500/20 scale-105',
    swatchUnchecked: 'border-green-300 dark:border-green-800 hover:border-green-500',
  },
  [HighlightColor.Teal]: {
    solid: 'bg-teal-500',
    rowBorder: 'border-b-teal-500',
    callout: 'bg-teal-50 dark:bg-teal-950/20 border-teal-500',
    swatch: 'bg-teal-100 dark:bg-teal-950/30',
    swatchChecked: 'border-teal-500 ring-2 ring-teal-500/20 scale-105',
    swatchUnchecked: 'border-teal-300 dark:border-teal-800 hover:border-teal-500',
  },
  [HighlightColor.Blue]: {
    solid: 'bg-blue-500',
    rowBorder: 'border-b-blue-500',
    callout: 'bg-blue-50 dark:bg-blue-950/20 border-blue-500',
    swatch: 'bg-blue-100 dark:bg-blue-950/30',
    swatchChecked: 'border-blue-500 ring-2 ring-blue-500/20 scale-105',
    swatchUnchecked: 'border-blue-300 dark:border-blue-800 hover:border-blue-500',
  },
  [HighlightColor.Purple]: {
    solid: 'bg-purple-500',
    rowBorder: 'border-b-purple-500',
    callout: 'bg-purple-50 dark:bg-purple-950/20 border-purple-500',
    swatch: 'bg-purple-100 dark:bg-purple-950/30',
    swatchChecked: 'border-purple-500 ring-2 ring-purple-500/20 scale-105',
    swatchUnchecked: 'border-purple-300 dark:border-purple-800 hover:border-purple-500',
  },
  [HighlightColor.Pink]: {
    solid: 'bg-pink-500',
    rowBorder: 'border-b-pink-500',
    callout: 'bg-pink-50 dark:bg-pink-950/20 border-pink-500',
    swatch: 'bg-pink-100 dark:bg-pink-950/30',
    swatchChecked: 'border-pink-500 ring-2 ring-pink-500/20 scale-105',
    swatchUnchecked: 'border-pink-300 dark:border-pink-800 hover:border-pink-500',
  },
};

/**
 * Classes for a stored highlight colour; undefined for none (or a value
 * that isn't a known colour)
 */
export function getHighlightColorClasses(
  color: string | null | undefined
): HighlightColorClasses | undefined {
  return color && Object.hasOwn(HIGHLIGHT_COLOR_CLASSES, color)
    ? HIGHLIGHT_COLOR_CLASSES[color as HighlightColor]
    : undefined;
}
