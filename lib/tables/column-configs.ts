/**
 * Column configurations for table views
 */

export interface ColumnConfig {
  id: string;
  label: string;
  defaultVisible: boolean;
  sortable: boolean;
  /** PocketBase field name for sorting (if different from id) */
  sortField?: string;
}

export interface EntityColumnConfig {
  columns: ColumnConfig[];
  defaultSort: string;
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export const customersColumnConfig: EntityColumnConfig = {
  columns: [
    {
      id: 'iid',
      label: 'ID',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'name',
      label: 'Name',
      defaultVisible: true,
      sortable: true,
      sortField: 'firstname', // Sort by firstname
    },
    {
      id: 'email',
      label: 'Email',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'phone',
      label: 'Telefon',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'active_reservations',
      label: 'Aktive Reservierungen',
      defaultVisible: true,
      sortable: false, // Computed client-side
    },
    {
      id: 'active_rentals',
      label: 'Aktive Ausleihen',
      defaultVisible: true,
      sortable: false, // Computed client-side
    },
    {
      id: 'total_rentals',
      label: 'Gesamt Ausleihen',
      defaultVisible: true,
      sortable: false, // Computed client-side
    },
    {
      id: 'street',
      label: 'Straße',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'postal_code',
      label: 'PLZ',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'city',
      label: 'Stadt',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'registered_on',
      label: 'Registriert',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'renewed_on',
      label: 'Verlängert',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'heard',
      label: 'Gehört über',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'newsletter',
      label: 'Newsletter',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'remark',
      label: 'Bemerkung',
      defaultVisible: false,
      sortable: true,
    },
  ],
  defaultSort: '-created',
};

// ============================================================================
// ITEMS
// ============================================================================

export const itemsColumnConfig: EntityColumnConfig = {
  columns: [
    {
      id: 'iid',
      label: 'ID',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'images',
      label: 'Bild',
      defaultVisible: true,
      sortable: false, // Array field
    },
    {
      id: 'name',
      label: 'Name',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'brand',
      label: 'Marke',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'model',
      label: 'Modell',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'category',
      label: 'Kategorie',
      defaultVisible: true,
      sortable: false, // Category is an array
    },
    {
      id: 'deposit',
      label: 'Kaution/Tara',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'parts',
      label: 'Teile',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'copies',
      label: 'Exemplare',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'total_rentals',
      label: 'Gesamt Ausleihen',
      defaultVisible: true,
      sortable: false, // Computed client-side
    },
    {
      id: 'status',
      label: 'Status',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'description',
      label: 'Beschreibung',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'packaging',
      label: 'Verpackung',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'manual',
      label: 'Anleitung',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'internal_note',
      label: 'Interne Notiz',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'added_on',
      label: 'Hinzugefügt',
      defaultVisible: false,
      sortable: true,
    },
  ],
  defaultSort: '-created',
};

// ============================================================================
// RENTALS
// ============================================================================

export const rentalsColumnConfig: EntityColumnConfig = {
  columns: [
    {
      id: 'customer',
      label: 'Kunde',
      defaultVisible: true,
      sortable: true,
      sortField: 'customer.firstname',
    },
    {
      id: 'items',
      label: 'Gegenstände',
      defaultVisible: true,
      sortable: false, // Array field
    },
    {
      id: 'rented_on',
      label: 'Ausgeliehen',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'expected_on',
      label: 'Erwartet',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'returned_on',
      label: 'Zurück',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'status',
      label: 'Status',
      defaultVisible: true,
      sortable: false, // Computed client-side
    },
    {
      id: 'extended_on',
      label: 'Verlängert',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'deposit',
      label: 'Kaution',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'deposit_back',
      label: 'Kaution zurück',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'remark',
      label: 'Bemerkung',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'employee',
      label: 'Mitarbeiter (Aus)',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'employee_back',
      label: 'Mitarbeiter (Ein)',
      defaultVisible: false,
      sortable: true,
    },
  ],
  defaultSort: '-created',
};

// ============================================================================
// RESERVATIONS
// ============================================================================

export const reservationsColumnConfig: EntityColumnConfig = {
  columns: [
    {
      id: 'customer_name',
      label: 'Kunde',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'items',
      label: 'Gegenstände',
      defaultVisible: true,
      sortable: false, // Array field
    },
    {
      id: 'customer_phone',
      label: 'Telefon',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'pickup',
      label: 'Wunschdatum',
      defaultVisible: true,
      sortable: true,
    },
    {
      id: 'status',
      label: 'Status',
      defaultVisible: true,
      sortable: true,
      sortField: 'done',
    },
    {
      id: 'customer_email',
      label: 'Email',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'customer_iid',
      label: 'Kunden-ID',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'is_new_customer',
      label: 'Neukunde',
      defaultVisible: false,
      sortable: true,
    },
    {
      id: 'comments',
      label: 'Kommentare',
      defaultVisible: false,
      sortable: true,
    },
  ],
  defaultSort: '-created',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get column config for entity type
 */
export function getColumnConfig(
  entity: 'customers' | 'items' | 'rentals' | 'reservations'
): EntityColumnConfig {
  switch (entity) {
    case 'customers':
      return customersColumnConfig;
    case 'items':
      return itemsColumnConfig;
    case 'rentals':
      return rentalsColumnConfig;
    case 'reservations':
      return reservationsColumnConfig;
  }
}
