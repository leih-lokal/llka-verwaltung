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
      id: "iid",
      label: "ID",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "name",
      label: "Name",
      defaultVisible: true,
      sortable: true,
      sortField: "firstname", // Sort by firstname
    },
    {
      id: "email",
      label: "Email",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "newsletter",
      label: "Newsletter",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "registered_on",
      label: "Registriert",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "active_rentals",
      label: "Aktive Ausleihen",
      defaultVisible: true,
      sortable: false, // Computed from customer_rentals view
    },
    {
      id: "total_rentals",
      label: "Alle Ausleihen",
      defaultVisible: true,
      sortable: false, // Computed from customer_rentals view
    },
    {
      id: "phone",
      label: "Telefon",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "street",
      label: "Straße",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "postal_code",
      label: "PLZ",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "city",
      label: "Stadt",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "renewed_on",
      label: "Verlängert",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "remark",
      label: "Bemerkung",
      defaultVisible: false,
      sortable: true,
    },
  ],
  defaultSort: "-iid", // Sort by ID, highest to lowest
};

// ============================================================================
// ITEMS
// ============================================================================

export const itemsColumnConfig: EntityColumnConfig = {
  columns: [
    {
      id: "iid",
      label: "ID",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "images",
      label: "Bild",
      defaultVisible: true,
      sortable: false, // Array field
    },
    {
      id: "name",
      label: "Name",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "brand",
      label: "Marke",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "model",
      label: "Modell",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "deposit",
      label: "Pfand",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "msrp",
      label: "UVP",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "parts",
      label: "Teile",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "copies",
      label: "Exemplare",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "total_rentals",
      label: "Alle Ausleihen",
      defaultVisible: true,
      sortable: false, // Stats computed client-side, cannot sort server-side
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "category",
      label: "Kategorie",
      defaultVisible: false,
      sortable: false, // Category is an array
    },
    {
      id: "description",
      label: "Beschreibung",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "packaging",
      label: "Verpackung",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "manual",
      label: "Anleitung",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "internal_note",
      label: "Interne Notiz",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "added_on",
      label: "Hinzugefügt",
      defaultVisible: false,
      sortable: true,
    },
  ],
  defaultSort: "name", // Sort by name, A to Z
};

// ============================================================================
// RENTALS
// ============================================================================

export const rentalsColumnConfig: EntityColumnConfig = {
  columns: [
    {
      id: "customer",
      label: "Nutzer:in",
      defaultVisible: true,
      sortable: true,
      sortField: "customer.firstname",
    },
    {
      id: "items",
      label: "Gegenstände",
      defaultVisible: true,
      sortable: false, // Array field
    },
    {
      id: "rented_on",
      label: "Ausgeliehen",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "employee",
      label: "Mitarbeiter Ausgabe",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "deposit",
      label: "Pfand gegeben",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "expected_on",
      label: "Erwartet",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "returned_on",
      label: "Zurück",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "employee_back",
      label: "Mitarbeiter Rücknahme",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "deposit_back",
      label: "Pfand zurück",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: true,
      sortable: false, // Computed client-side
    },
    {
      id: "extended_on",
      label: "Verlängert am",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "remark",
      label: "Bemerkung",
      defaultVisible: false,
      sortable: true,
    },
  ],
  defaultSort: "-rented_on", // Sort by expected return date, closest to furthest
};

// ============================================================================
// RESERVATIONS
// ============================================================================

export const reservationsColumnConfig: EntityColumnConfig = {
  columns: [
    {
      id: "otp",
      label: "OTP",
      defaultVisible: true,
      sortable: false,
    },
    {
      id: "is_new_customer",
      label: "Neunutzer?",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "customer_name",
      label: "Nutzer:in",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "items",
      label: "Gegenstände",
      defaultVisible: true,
      sortable: false, // Array field
    },
    {
      id: "pickup",
      label: "Abholdatum",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "comments",
      label: "Kommentare",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: true,
      sortable: true,
      sortField: "done",
    },
    {
      id: "actions",
      label: "Aktionen",
      defaultVisible: true,
      sortable: false,
    },
    {
      id: "on_premises",
      label: "Vor Ort",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "customer_phone",
      label: "Telefon",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "customer_email",
      label: "Email",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "customer_iid",
      label: "Nutzer-ID",
      defaultVisible: false,
      sortable: true,
    },
  ],
  defaultSort: "pickup",
};

// ============================================================================
// LOGS
// ============================================================================

export const logsColumnConfig: EntityColumnConfig = {
  columns: [
    {
      id: "created",
      label: "Zeitstempel",
      defaultVisible: true,
      sortable: true,
    },
    {
      id: "level",
      label: "Level",
      defaultVisible: false,
      sortable: true,
    },
    {
      id: "method",
      label: "Request-Typ",
      defaultVisible: true,
      sortable: false, // Field is nested in data object
    },
    {
      id: "message",
      label: "Nachricht",
      defaultVisible: true,
      sortable: false, // Text field, not useful to sort
    },
  ],
  defaultSort: "-created", // Sort by created, newest to oldest
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get column config for entity type
 */
export function getColumnConfig(
  entity: "customers" | "items" | "rentals" | "reservations" | "logs",
): EntityColumnConfig {
  switch (entity) {
    case "customers":
      return customersColumnConfig;
    case "items":
      return itemsColumnConfig;
    case "rentals":
      return rentalsColumnConfig;
    case "reservations":
      return reservationsColumnConfig;
    case "logs":
      return logsColumnConfig;
  }
}
