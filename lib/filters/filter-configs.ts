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
  type: 'status' | 'date' | 'category' | 'numeric' | 'boolean' | 'text';
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

  /** Available text filters */
  textFilters?: FilterConfig[];
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export const customersFilterConfig: EntityFilterConfig = {
  searchFields: ['firstname', 'lastname', 'iid'],

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
    {
      id: 'highlight_color',
      label: 'Markierung',
      type: 'category',
      field: 'highlight_color',
      options: [
        { value: 'red', label: 'Rot' },
        { value: 'orange', label: 'Orange' },
        { value: 'yellow', label: 'Gelb' },
        { value: 'green', label: 'Grün (Team-Mitglied)' },
        { value: 'teal', label: 'Türkis' },
        { value: 'blue', label: 'Blau' },
        { value: 'purple', label: 'Lila' },
        { value: 'pink', label: 'Rosa' },
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
    {
      id: 'highlight_color',
      label: 'Markierung',
      type: 'category',
      field: 'highlight_color',
      options: [
        { value: 'red', label: 'Rot' },
        { value: 'orange', label: 'Orange' },
        { value: 'yellow', label: 'Gelb' },
        { value: 'green', label: 'Grün (Team-Mitglied)' },
        { value: 'teal', label: 'Türkis' },
        { value: 'blue', label: 'Blau' },
        { value: 'purple', label: 'Lila' },
        { value: 'pink', label: 'Rosa' },
      ],
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
  searchFields: ['customer.firstname', 'customer.lastname', 'customer.iid', 'items.iid', 'items.name'],

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

  textFilters: [
    {
      id: 'employee',
      label: 'Mitarbeiter (Ausgabe)',
      type: 'text',
      field: 'employee',
      placeholder: 'Name eingeben',
    },
    {
      id: 'employee_back',
      label: 'Mitarbeiter (Rücknahme)',
      type: 'text',
      field: 'employee_back',
      placeholder: 'Name eingeben',
    },
  ],
};

// ============================================================================
// RESERVATIONS
// ============================================================================

export const reservationsFilterConfig: EntityFilterConfig = {
  searchFields: ['customer_name', 'customer_iid', 'otp', 'items.iid', 'items.name'],

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
      label: 'Nutzertyp',
      type: 'boolean',
      field: 'is_new_customer',
      options: [
        { value: 'true', label: 'Townie' },
        { value: 'false', label: 'Bestandsnutzer' },
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
// LOGS
// ============================================================================

export const logsFilterConfig: EntityFilterConfig = {
  searchFields: ['message'],

  statusFilters: [
    {
      id: 'level',
      label: 'Level',
      type: 'status',
      field: 'level',
      options: [
        { value: '0', label: 'Info' },
        { value: '4', label: 'Warnung' },
        { value: '8', label: 'Fehler' },
      ],
    },
  ],

  categoryFilters: [
    {
      id: 'request_method',
      label: 'Request-Typ',
      type: 'category',
      field: 'data.method',
      options: [
        { value: 'GET', label: 'GET' },
        { value: 'POST', label: 'POST' },
        { value: 'PATCH', label: 'PATCH' },
        { value: 'PUT', label: 'PUT' },
        { value: 'DELETE', label: 'DELETE' },
        { value: '__none__', label: 'Keine (Nicht-REST)' },
      ],
    },
  ],

  dateFilters: [
    {
      id: 'created',
      label: 'Erstellt',
      type: 'date',
      field: 'created',
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
  entity: 'customers' | 'items' | 'rentals' | 'reservations' | 'logs'
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
    case 'logs':
      return logsFilterConfig;
  }
}
