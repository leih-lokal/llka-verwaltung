/**
 * TypeScript type definitions for LeihLokal Verwaltung
 * Library management system types
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Item categories in the library.
 *
 * NOTE: PocketBase stores these as the German display strings
 * (see `GermanCategory` below) — not the English enum values. This
 * enum is kept for the English-key → German-label mapping in
 * `lib/constants/categories.ts`, but for the data stored on `Item`
 * use the `GermanCategory` type.
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
 * Actual category values persisted in PocketBase.
 */
export type GermanCategory =
  | 'Küche'
  | 'Haushalt'
  | 'Garten'
  | 'Kinder'
  | 'Freizeit'
  | 'Heimwerken'
  | 'Sonstige';

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
 * Booking status values
 */
export enum BookingStatus {
  Reserved = 'reserved',
  Active = 'active',
  Returned = 'returned',
  Overdue = 'overdue',
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
 * Authenticated superuser returned by `pb.authStore.model`.
 * Narrow shape — PocketBase's own SDK types this as `unknown`.
 */
export interface AuthUser extends BaseRecord {
  email: string;
  verified?: boolean;
  emailVisibility?: boolean;
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

  /** Highlight color for special attention ('' = none; sending '' clears it) */
  highlight_color?: HighlightColor | '';
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

  /** Categories (can be multiple). Stored as German strings. */
  category: GermanCategory[];

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

  /** Highlight color ('' = none; sending '' clears it) */
  highlight_color?: HighlightColor | '';

  /** Internal staff note (not visible to customers) */
  internal_note?: string;

  /** Date added to inventory */
  added_on: string;

  /** Manufacturer suggested retail price */
  msrp?: number;

  /** Protected items cannot be reserved */
  is_protected?: boolean;
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

// ============================================================================
// BOOKING (Buchungen)
// ============================================================================

/**
 * Booking record from database
 */
export interface Booking extends BaseRecord {
  /** Item ID reference (single protected item) */
  item: string;

  /** Customer ID reference (optional for walk-ins) */
  customer?: string;

  /** Customer name (always required) */
  customer_name: string;

  /** Customer phone */
  customer_phone?: string;

  /** Customer email */
  customer_email?: string;

  /** Pickup / start date */
  start_date: string;

  /** Return / end date */
  end_date: string;

  /** Booking status */
  status: BookingStatus;

  /** Staff notes */
  notes?: string;

  /** Associated rental ID (set when booking is converted to a rental) */
  associated_rental?: string;
}

/**
 * Booking with expanded item and customer details
 */
export interface BookingExpanded extends Booking {
  expand: {
    item: Item;
    customer?: Customer;
  };
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

// ============================================================================
// SETTINGS
// ============================================================================

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

  /** Opening hours as array of [day, open, close] tuples */
  opening_hours: [string, string, string][];

  /** Image auto-compression settings applied client-side before upload */
  image_compression: ImageCompressionSettings;
}

/**
 * Output format for compressed images.
 * - `keep`: re-encode in the source format (PNG stays PNG, JPEG stays JPEG)
 * - `webp`: re-encode all to WebP (smaller files, but the target field's
 *   `mimeTypes` validator must allow image/webp)
 * - `jpeg`: re-encode all to JPEG (no transparency, broadest compatibility)
 */
export type ImageOutputFormat = 'keep' | 'webp' | 'jpeg';

export interface ImageCompressionSettings {
  enabled: boolean;
  /** Longest-edge cap in pixels; smaller images are not upscaled */
  max_dimension_px: number;
  /** Encoder quality 1-100 (used for jpeg/webp output) */
  quality: number;
  output_format: ImageOutputFormat;
  /** Files smaller than this are uploaded as-is */
  skip_if_smaller_than_kb: number;
}

export const DEFAULT_IMAGE_COMPRESSION: ImageCompressionSettings = {
  enabled: true,
  max_dimension_px: 1600,
  quality: 82,
  output_format: 'keep',
  skip_if_smaller_than_kb: 200,
};

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
  opening_hours: [
    ['mon', '15:00', '19:00'],
    ['thu', '15:00', '19:00'],
    ['fri', '15:00', '19:00'],
    ['sat', '10:00', '14:00'],
  ],
  image_compression: DEFAULT_IMAGE_COMPRESSION,
};

// ============================================================================
// LOGS
// ============================================================================

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
