/**
 * Filter configurations for each entity type
 */

import { ItemStatus, ItemCategory, RentalStatus } from '@/types';
import {
  ITEM_STATUS_LABELS,
  RENTAL_STATUS_LABELS,
} from '@/lib/constants/statuses';
import { CATEGORY_OPTIONS } from '@/lib/constants/categories';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  id: string;
  label: string;
  type: 'status' | 'date' | 'category' | 'numeric' | 'boolean';
  field: string;
  options?: FilterOption[];
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface EntityFilterConfig {
  /** Search fields for text search */
  searchFields: string[];

  /** Available status filters */
  statusFilters?: FilterConfig[];

  /** Available date filters */
  dateFilters?: FilterConfig[];

  /** Available category filters */
  categoryFilters?: FilterConfig[];

  /** Available numeric filters */
  numericFilters?: FilterConfig[];
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export const customersFilterConfig: EntityFilterConfig = {
  searchFields: ['firstname', 'lastname', 'email', 'phone', 'iid'],

  dateFilters: [
    {
      id: 'registered_on',
      label: 'Registrierungsdatum',
      type: 'date',
      field: 'registered_on',
      placeholder: 'Datum auswählen',
    },
    {
      id: 'renewed_on',
      label: 'Verlängerungsdatum',
      type: 'date',
      field: 'renewed_on',
      placeholder: 'Datum auswählen',
    },
  ],

  categoryFilters: [
    {
      id: 'newsletter',
      label: 'Newsletter',
      type: 'boolean',
      field: 'newsletter',
      options: [
        { value: 'true', label: 'Ja' },
        { value: 'false', label: 'Nein' },
      ],
    },
  ],
};

// ============================================================================
// ITEMS
// ============================================================================

export const itemsFilterConfig: EntityFilterConfig = {
  searchFields: ['name', 'brand', 'iid', 'synonyms'],

  statusFilters: [
    {
      id: 'status',
      label: 'Status',
      type: 'status',
      field: 'status',
      options: Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
  ],

  categoryFilters: [
    {
      id: 'category',
      label: 'Kategorie',
      type: 'category',
      field: 'category',
      options: CATEGORY_OPTIONS, // Uses German category names as stored in PocketBase
    },
  ],

  dateFilters: [
    {
      id: 'added_on',
      label: 'Hinzugefügt',
      type: 'date',
      field: 'added_on',
      placeholder: 'Datum auswählen',
    },
  ],

  numericFilters: [
    {
      id: 'deposit',
      label: 'Kaution',
      type: 'numeric',
      field: 'deposit',
      placeholder: 'Betrag',
      min: 0,
      max: 1000,
    },
    {
      id: 'copies',
      label: 'Anzahl Exemplare',
      type: 'numeric',
      field: 'copies',
      placeholder: 'Anzahl',
      min: 0,
      max: 100,
    },
  ],
};

// ============================================================================
// RENTALS
// ============================================================================

export const rentalsFilterConfig: EntityFilterConfig = {
  searchFields: ['customer.firstname', 'customer.lastname', 'customer.iid'],

  statusFilters: [
    {
      id: 'status',
      label: 'Status',
      type: 'status',
      field: '__computed_status__', // This is computed client-side
      options: Object.entries(RENTAL_STATUS_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
  ],

  dateFilters: [
    {
      id: 'rented_on',
      label: 'Ausgeliehen',
      type: 'date',
      field: 'rented_on',
      placeholder: 'Datum auswählen',
    },
    {
      id: 'expected_on',
      label: 'Erwartet',
      type: 'date',
      field: 'expected_on',
      placeholder: 'Datum auswählen',
    },
    {
      id: 'returned_on',
      label: 'Zurückgegeben',
      type: 'date',
      field: 'returned_on',
      placeholder: 'Datum auswählen',
    },
  ],

  numericFilters: [
    {
      id: 'deposit',
      label: 'Kaution',
      type: 'numeric',
      field: 'deposit',
      placeholder: 'Betrag',
      min: 0,
      max: 1000,
    },
  ],
};

// ============================================================================
// RESERVATIONS
// ============================================================================

export const reservationsFilterConfig: EntityFilterConfig = {
  searchFields: ['customer_name', 'customer_phone', 'customer_iid'],

  statusFilters: [
    {
      id: 'done',
      label: 'Status',
      type: 'status',
      field: 'done',
      options: [
        { value: 'false', label: 'Offen' },
        { value: 'true', label: 'Erledigt' },
      ],
    },
  ],

  categoryFilters: [
    {
      id: 'is_new_customer',
      label: 'Kundentyp',
      type: 'boolean',
      field: 'is_new_customer',
      options: [
        { value: 'true', label: 'Neukunde' },
        { value: 'false', label: 'Bestandskunde' },
      ],
    },
  ],

  dateFilters: [
    {
      id: 'pickup',
      label: 'Abholung',
      type: 'date',
      field: 'pickup',
      placeholder: 'Datum auswählen',
    },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get filter config for entity type
 */
export function getFilterConfig(
  entity: 'customers' | 'items' | 'rentals' | 'reservations'
): EntityFilterConfig {
  switch (entity) {
    case 'customers':
      return customersFilterConfig;
    case 'items':
      return itemsFilterConfig;
    case 'rentals':
      return rentalsFilterConfig;
    case 'reservations':
      return reservationsFilterConfig;
  }
}
