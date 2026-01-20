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
  PartiallyReturned = 'partially_returned',
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
  Purple = 'purple',
  Orange = 'orange',
  Pink = 'pink',
  Teal = 'teal',
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

  /** Number of parts/accessories */
  parts?: number;

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

  /** Manufacturer suggested retail price */
  msrp?: number;
}

/**
 * Item with computed rental statistics
 */
export interface ItemWithStats extends Item {
  /** Total number of times rented (all time) */
  total_rentals: number;

  /** Number of currently active rentals */
  active_rentals: number;

  /** Days since last rental (null if never rented) */
  days_since_last_rental: number | null;
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
  parts?: number;
  copies: number;
  status: ItemStatus;
  images?: FileList;
  highlight_color?: HighlightColor;
  internal_note?: string;
  msrp?: number;
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

  /** Number of copies requested for each item (JSON object: {item_id: count}) */
  requested_copies?: Record<string, number>;

  /** Number of copies returned for each item (JSON object: {item_id: count}) */
  returned_items?: Record<string, number>;

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
 * Return status for individual items in a rental
 */
export interface ItemReturnStatus {
  /** Item ID */
  itemId: string;

  /** Number of copies requested */
  requestedCopies: number;

  /** Number of copies returned */
  returnedCopies: number;

  /** Number of copies still out */
  remainingCopies: number;

  /** Whether all copies of this item are returned */
  isFullyReturned: boolean;
}

/**
 * Overall return status for a rental
 */
export interface RentalReturnStatus {
  /** Whether all items in the rental are fully returned */
  isFullyReturned: boolean;

  /** Whether some (but not all) items/copies are returned */
  isPartiallyReturned: boolean;

  /** Whether there are any unreturned items/copies */
  hasUnreturnedItems: boolean;

  /** Total number of item copies requested */
  totalItemsRequested: number;

  /** Total number of item copies returned */
  totalItemsReturned: number;

  /** Return status for each individual item */
  itemStatuses: ItemReturnStatus[];
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

  /** Server-generated 6-digit OTP (read-only) */
  otp?: string;

  /** Whether customer is picking up on premises */
  on_premises: boolean;
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
  on_premises: boolean;
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
 * Application settings (legacy, to be removed)
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

/**
 * White-label settings stored in PocketBase settings collection
 */
export interface Settings extends BaseRecord {
  /** Application display name (e.g., "BiblioBorrow") */
  app_name: string;

  /** Application tagline/subtitle (e.g., "Verwaltungssoftware") */
  tagline: string;

  /** Logo file name (uploaded to PocketBase) */
  logo?: string;

  /** Favicon file name (uploaded to PocketBase) */
  favicon?: string;

  /** Copyright holder name for footer */
  copyright_holder: string;

  /** Show "Powered by LLKA-V" branding */
  show_powered_by: boolean;

  /** Primary theme color (oklch or hex) */
  primary_color: string;

  /** ID format prefix pattern (e.g., "#", "LL-") */
  id_format: string;

  /** ID padding (0 = none, 4 = pad to 4 digits) */
  id_padding: number;

  /** Enable reservations feature */
  reservations_enabled: boolean;

  /** Tracks whether initial setup is complete */
  setup_complete: boolean;
}

/**
 * Settings form data for editing
 */
export interface SettingsFormData {
  app_name: string;
  tagline: string;
  logo?: File;
  favicon?: File;
  copyright_holder: string;
  show_powered_by: boolean;
  primary_color: string;
  id_format: string;
  id_padding: number;
  reservations_enabled: boolean;
}

/**
 * Default settings values when no settings exist
 */
export const DEFAULT_SETTINGS: Omit<Settings, keyof BaseRecord> = {
  app_name: 'leih.lokal',
  tagline: 'Verwaltungssoftware',
  logo: undefined,
  favicon: undefined,
  copyright_holder: 'Bürgerstiftung Karlsruhe',
  show_powered_by: true,
  primary_color: 'oklch(0.515 0.283 27.87)',
  id_format: '#',
  id_padding: 0,
  reservations_enabled: true,
  setup_complete: false,
};

// ============================================================================
// LOGS
// ============================================================================

/**
 * Log level enum matching PocketBase numeric levels
 */
export enum LogLevel {
  Info = 0,
  Warning = 4,
  Error = 8,
}

/**
 * Log level type as string
 */
export type LogLevelString = 'info' | 'warn' | 'error';

/**
 * Log entry from PocketBase API (with numeric level)
 */
export interface LogEntryRaw extends BaseRecord {
  /** Log level (numeric: 0=info, 4=warn, 8=error) */
  level: number;

  /** Log message */
  message: string;

  /** Additional data including type, method, etc. */
  data?: {
    type?: string;
    method?: string;
    [key: string]: unknown;
  };
}

/**
 * Log entry (normalized with string level)
 */
export interface LogEntry extends BaseRecord {
  /** Log level */
  level: LogLevelString;

  /** Log message */
  message: string;

  /** Additional data including type, method, etc. */
  data?: {
    type?: string;
    method?: string;
    [key: string]: unknown;
  };
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

// ============================================================================
// DASHBOARD METRICS
// ============================================================================

/**
 * Today's activity metrics for dashboard
 */
export interface TodayActivityMetrics {
  /** Number of checkouts today */
  checkouts: number;
  /** Number of returns today */
  returns: number;
  /** Number of on-time returns today */
  onTimeReturns: number;
  /** Number of late returns today */
  lateReturns: number;
  /** Number of new customers registered today */
  newCustomers: number;
  /** Number of new reservations created today */
  newReservations: number;
}

/**
 * Overdue rental breakdown by severity
 */
export interface OverdueBreakdown {
  /** Number of rentals 1-3 days overdue */
  severity1to3Days: number;
  /** Number of rentals 4-7 days overdue */
  severity4to7Days: number;
  /** Number of rentals 8+ days overdue */
  severity8PlusDays: number;
  /** Total number of overdue rentals */
  total: number;
}

/**
 * Rental due within a time window
 */
export interface DueThisWeekItem {
  /** The rental record */
  rental: RentalExpanded;
  /** Due date as ISO string */
  dueDate: string;
  /** Days until due (negative if overdue) */
  daysUntilDue: number;
  /** Customer name */
  customerName: string;
  /** Number of items in rental */
  itemCount: number;
}
