/**
 * Item category constants and utilities
 */

import { ItemCategory } from '@/types';

/**
 * Category labels (German)
 */
export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  [ItemCategory.Kitchen]: 'Küche',
  [ItemCategory.Household]: 'Haushalt',
  [ItemCategory.Garden]: 'Garten',
  [ItemCategory.Kids]: 'Kinder',
  [ItemCategory.Leisure]: 'Freizeit',
  [ItemCategory.DIY]: 'Heimwerken',
  [ItemCategory.Other]: 'Sonstiges',
};

/**
 * Category options for selects/filters
 */
export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  })
);

/**
 * Get category label by value
 */
export function getCategoryLabel(category: ItemCategory): string {
  return CATEGORY_LABELS[category] || category;
}
