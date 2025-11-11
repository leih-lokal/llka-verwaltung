/**
 * TypeScript type definitions for LeihLokal Verwaltung
 * Library management system types
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Item categories in the library
 */
export enum ItemCategory {
  Kitchen = 'kitchen',
  Household = 'household',
  Garden = 'garden',
  Kids = 'kids',
  Leisure = 'leisure',
  DIY = 'diy',
  Other = 'other',
}

/**
 * Item status values
 */
export enum ItemStatus {
  InStock = 'instock',
  OutOfStock = 'outofstock',
  Reserved = 'reserved',
  OnBackorder = 'onbackorder',
  Lost = 'lost',
  Repairing = 'repairing',
  ForSale = 'forsale',
  Deleted = 'deleted',
}

/**
 * Rental status values (computed from dates)
 */
export enum RentalStatus {
  Active = 'active',
  Returned = 'returned',
  Overdue = 'overdue',
  DueToday = 'due_today',
  ReturnedToday = 'returned_today',
}

/**
 * Highlight colors for items and customers
 */
export enum HighlightColor {
  Green = 'green',
  Blue = 'blue',
  Yellow = 'yellow',
  Red = 'red',
}

// ============================================================================
// BASE TYPES
// ============================================================================

/**
 * Base PocketBase record with common fields
 */
export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
}

/**
 * Pagination parameters for list queries
 */
export interface PaginationParams {
  page: number;
  perPage: number;
}

/**
 * Sort parameters
 */
export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Filter parameters
 */
export interface FilterParams {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | '~' | '!~';
  value: string | number | boolean;
}

/**
 * List response from PocketBase
 */
export interface ListResult<T> {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

// ============================================================================
// CUSTOMER (Nutzer:innen)
// ============================================================================

/**
 * Customer record from database
 */
export interface Customer extends BaseRecord {
  /** Customer ID (auto-increment, user-facing) */
  iid: number;

  /** First name */
  firstname: string;

  /** Last name */
  lastname: string;

  /** Email address */
  email?: string;

  /** Phone number */
  phone?: string;

  /** Street address */
  street?: string;

  /** Postal code */
  postal_code?: string;

  /** City */
  city?: string;

  /** Registration date */
  registered_on: string;

  /** Last renewal date */
  renewed_on?: string;

  /** How they heard about the library */
  heard?: string;

  /** Newsletter subscription */
  newsletter: boolean;

  /** Additional remarks */
  remark?: string;

  /** Highlight color for special attention */
  highlight_color?: HighlightColor;
}

/**
 * Customer with computed rental statistics (from customer_rentals view)
 */
export interface CustomerWithStats extends Customer {
  /** Number of currently active rentals */
  active_rentals: number;

  /** Total number of rentals (all time) */
  total_rentals: number;
}

/**
 * Customer rentals view record
 */
export interface CustomerRentals {
  id: string;
  num_active_rentals: number;
  num_rentals: number;
}

/**
 * Form data for creating/editing a customer
 */
export interface CustomerFormData {
  firstname: string;
  lastname: string;
  email?: string;
  phone?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  registered_on: Date;
  renewed_on?: Date;
  heard?: string;
  newsletter: boolean;
  remark?: string;
  highlight_color?: HighlightColor;
}

// ============================================================================
// ITEM (Gegenstände)
// ============================================================================

/**
 * Item record from database
 */
export interface Item extends BaseRecord {
  /** Item ID (auto-increment, user-facing) */
  iid: number;

  /** Item name */
  name: string;

  /** Brand */
  brand?: string;

  /** Model */
  model?: string;

  /** Description */
  description?: string;

  /** Categories (can be multiple) */
  category: ItemCategory[];

  /** Deposit amount in EUR */
  deposit: number;

  /** Synonyms for search */
  synonyms: string[];

  /** Packaging details */
  packaging?: string;

  /** Manual included? */
  manual?: string;

  /** Parts list */
  parts?: string;

  /** Number of copies available */
  copies: number;

  /** Current status */
  status: ItemStatus;

  /** Image file names */
  images: string[];

  /** Highlight color */
  highlight_color?: HighlightColor;

  /** Internal staff note (not visible to customers) */
  internal_note?: string;

  /** Date added to inventory */
  added_on: string;
}

/**
 * Item with computed rental statistics
 */
export interface ItemWithStats extends Item {
  /** Total number of times rented */
  rental_count: number;

  /** Currently available for rental? */
  is_available: boolean;
}

/**
 * Form data for creating/editing an item
 */
export interface ItemFormData {
  name: string;
  brand?: string;
  model?: string;
  description?: string;
  category: ItemCategory[];
  deposit: number;
  synonyms: string[];
  packaging?: string;
  manual?: string;
  parts?: string;
  copies: number;
  status: ItemStatus;
  images?: FileList;
  highlight_color?: HighlightColor;
  internal_note?: string;
}

// ============================================================================
// RENTAL (Leihvorgänge)
// ============================================================================

/**
 * Rental record from database
 */
export interface Rental extends BaseRecord {
  /** Customer ID reference */
  customer: string;

  /** Item ID references (multiple items per rental) */
  items: string[];

  /** Deposit amount given */
  deposit: number;

  /** Deposit amount returned */
  deposit_back: number;

  /** Date rented */
  rented_on: string;

  /** Date returned (null if still active) */
  returned_on?: string;

  /** Expected return date */
  expected_on: string;

  /** Extended return date */
  extended_on?: string;

  /** Remarks */
  remark?: string;

  /** Employee who checked out */
  employee?: string;

  /** Employee who checked in */
  employee_back?: string;
}

/**
 * Rental with expanded customer and item details
 */
export interface RentalExpanded extends Rental {
  /** Full customer details */
  expand: {
    customer: Customer;
    items: Item[];
  };
}

/**
 * Rental with computed status
 */
export interface RentalWithStatus extends RentalExpanded {
  /** Computed rental status */
  status: RentalStatus;

  /** Days overdue (negative if not yet due) */
  days_overdue: number;
}

/**
 * Form data for creating/editing a rental
 */
export interface RentalFormData {
  customer_id: string;
  item_ids: string[];
  deposit: number;
  rented_on: Date;
  expected_on: Date;
  remark?: string;
  employee?: string;
}

/**
 * Form data for returning a rental
 */
export interface ReturnRentalFormData {
  returned_on: Date;
  deposit_back: number;
  employee_back?: string;
  remark?: string;
}

// ============================================================================
// RESERVATION (Reservierungen)
// ============================================================================

/**
 * Reservation record from database
 */
export interface Reservation extends BaseRecord {
  /** Customer ID (if existing customer) */
  customer_iid?: number;

  /** Customer name (if new customer) */
  customer_name: string;

  /** Customer phone */
  customer_phone?: string;

  /** Customer email */
  customer_email?: string;

  /** Is this a new customer (not yet registered)? */
  is_new_customer: boolean;

  /** Comments */
  comments?: string;

  /** Is reservation completed? */
  done: boolean;

  /** Item ID references */
  items: string[];

  /** Pickup date/time */
  pickup: string;
}

/**
 * Reservation with expanded item details
 */
export interface ReservationExpanded extends Reservation {
  expand: {
    items: Item[];
  };
}

/**
 * Form data for creating/editing a reservation
 */
export interface ReservationFormData {
  customer_iid?: number;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  is_new_customer: boolean;
  comments?: string;
  item_ids: string[];
  pickup: Date;
}

// ============================================================================
// NOTE (Dashboard Sticky Notes)
// ============================================================================

/**
 * Note record from database
 */
export interface Note extends BaseRecord {
  /** Note content (rich text) */
  content: string;

  /** Background color */
  background_color: string;

  /** Order index for drag-and-drop */
  order_index: number;
}

/**
 * Form data for creating/editing a note
 */
export interface NoteFormData {
  content: string;
  background_color: string;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Dashboard statistics
 */
export interface Stats {
  /** Active customers (rented in last 3 months) */
  active_customers: {
    month: string;
    count: number;
  }[];

  /** Total rentals over time */
  total_rentals: {
    month: string;
    active: number;
    returned: number;
  }[];

  /** New customers per month */
  new_customers: {
    month: string;
    count: number;
  }[];

  /** Inventory by category */
  inventory: {
    category: ItemCategory;
    count: number;
  }[];

  /** Overall stats */
  overview: {
    total_customers: number;
    total_items: number;
    active_rentals: number;
    overdue_rentals: number;
  };
}

// ============================================================================
// AUTOCOMPLETE
// ============================================================================

/**
 * Autocomplete option
 */
export interface AutocompleteOption {
  value: string;
  label: string;
  metadata?: Record<string, unknown>;
}

/**
 * Customer autocomplete option
 */
export interface CustomerAutocompleteOption extends AutocompleteOption {
  metadata: {
    customer: Customer;
  };
}

/**
 * Item autocomplete option
 */
export interface ItemAutocompleteOption extends AutocompleteOption {
  metadata: {
    item: Item;
  };
}

// ============================================================================
// API & ERROR HANDLING
// ============================================================================

/**
 * API error response
 */
export interface ApiError {
  code: number;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * API success response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Application settings
 */
export interface AppSettings {
  /** PocketBase API URL */
  api_url: string;

  /** Admin username */
  admin_username: string;

  /** Admin password (stored encrypted) */
  admin_password: string;

  /** Default rental period in days */
  default_rental_period: number;

  /** Enable notifications */
  notifications_enabled: boolean;
}

// ============================================================================
// LOGS
// ============================================================================

/**
 * Log entry
 */
export interface LogEntry extends BaseRecord {
  /** Log level */
  level: 'info' | 'warn' | 'error';

  /** Log message */
  message: string;

  /** User who triggered the action */
  user?: string;

  /** Action type */
  action?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// UI STATE
// ============================================================================

/**
 * Table filter state
 */
export interface TableFilterState {
  search: string;
  filters: FilterParams[];
  sort: SortParams | null;
  pagination: PaginationParams;
}

/**
 * Loading state
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Generic async state
 */
export interface AsyncState<T> {
  data: T | null;
  loading: LoadingState;
  error: ApiError | null;
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Real-time event action types from PocketBase
 */
export type RealtimeAction = 'create' | 'update' | 'delete';

/**
 * Real-time subscription event from PocketBase
 */
export interface RealtimeEvent<T = BaseRecord> {
  /** Action that triggered the event */
  action: RealtimeAction;
  /** The affected record (base record, NOT expanded) */
  record: T;
}

/**
 * Real-time subscription callbacks
 */
export interface RealtimeCallbacks<T = BaseRecord> {
  /** Called when a record is created */
  onCreated?: (record: T) => void | Promise<void>;
  /** Called when a record is updated */
  onUpdated?: (record: T) => void | Promise<void>;
  /** Called when a record is deleted */
  onDeleted?: (record: T) => void | Promise<void>;
}

/**
 * Real-time subscription options
 */
export interface RealtimeSubscriptionOptions<T = BaseRecord> extends RealtimeCallbacks<T> {
  /** PocketBase filter string (optional) */
  filter?: string;
  /** Enable/disable subscription conditionally */
  enabled?: boolean;
}

/**
 * Connection state for real-time subscriptions
 */
export enum ConnectionState {
  Connecting = 'connecting',
  Connected = 'connected',
  Disconnected = 'disconnected',
  Error = 'error',
}

/**
 * Real-time connection info
 */
export interface RealtimeConnectionInfo {
  /** Current connection state */
  state: ConnectionState;
  /** Error message if state is Error */
  error?: string;
  /** Last connection time */
  lastConnected?: Date;
}
