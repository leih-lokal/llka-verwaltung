/**
 * Item category constants and utilities
 */

import { ItemCategory, type GermanCategory } from '@/types';

/**
 * Category labels (German) - these are the actual values stored in the database
 */
export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  [ItemCategory.Kitchen]: 'Küche',
  [ItemCategory.Household]: 'Haushalt',
  [ItemCategory.Garden]: 'Garten',
  [ItemCategory.Kids]: 'Kinder',
  [ItemCategory.Leisure]: 'Freizeit',
  [ItemCategory.DIY]: 'Heimwerken',
  [ItemCategory.Other]: 'Sonstige',
};

/**
 * German category values as stored in PocketBase
 */
export const GERMAN_CATEGORIES = {
  KITCHEN: 'Küche',
  HOUSEHOLD: 'Haushalt',
  GARDEN: 'Garten',
  KIDS: 'Kinder',
  LEISURE: 'Freizeit',
  DIY: 'Heimwerken',
  OTHER: 'Sonstige',
} as const;

/**
 * Array of all German category values
 */
export const GERMAN_CATEGORY_VALUES = Object.values(GERMAN_CATEGORIES);

/**
 * Category options for selects/filters (using German values)
 */
export const CATEGORY_OPTIONS = [
  { value: GERMAN_CATEGORIES.KITCHEN, label: GERMAN_CATEGORIES.KITCHEN },
  { value: GERMAN_CATEGORIES.HOUSEHOLD, label: GERMAN_CATEGORIES.HOUSEHOLD },
  { value: GERMAN_CATEGORIES.GARDEN, label: GERMAN_CATEGORIES.GARDEN },
  { value: GERMAN_CATEGORIES.KIDS, label: GERMAN_CATEGORIES.KIDS },
  { value: GERMAN_CATEGORIES.LEISURE, label: GERMAN_CATEGORIES.LEISURE },
  { value: GERMAN_CATEGORIES.DIY, label: GERMAN_CATEGORIES.DIY },
  { value: GERMAN_CATEGORIES.OTHER, label: GERMAN_CATEGORIES.OTHER },
];

/**
 * Get category label by value (supports both English enum and German values)
 */
export function getCategoryLabel(category: ItemCategory | GermanCategory | string): string {
  // If it's already a German category, return it as is.
  if ((GERMAN_CATEGORY_VALUES as readonly string[]).includes(category)) {
    return category;
  }
  // Otherwise look it up in the labels map.
  return CATEGORY_LABELS[category as ItemCategory] || category;
}
