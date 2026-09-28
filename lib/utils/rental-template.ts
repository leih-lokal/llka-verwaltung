/**
 * Utility functions for creating rental templates from reservations
 * (and bookings): unsaved, prefilled rentals the rental sheet opens with
 */

import { collections } from '@/lib/pocketbase/client';
import type { RentalExpanded, Customer, Item } from '@/types';
import { dateToLocalString } from './formatting';
import { getCopyCount, type InstanceData } from './instance-data';

/** Default loan period in days */
export const DEFAULT_LOAN_DAYS = 7;

/**
 * Default expected return date for a new rental (local midnight).
 * The loan period starts on the reservation's pickup day if that day is
 * still in the future — the date the customer agreed to — otherwise today
 * (a pickup later today, a past pickup, or none at all).
 *
 * @param pickup - Reservation pickup datetime (ISO or PocketBase format)
 * @param now - Current time (injectable for tests)
 */
export function getDefaultExpectedDate(
  pickup?: string | null,
  now: Date = new Date()
): Date {
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (pickup) {
    // PocketBase separates date and time with a space, which not every
    // JS engine parses
    const pickupDate = new Date(pickup.replace(' ', 'T'));
    if (!isNaN(pickupDate.getTime())) {
      const pickupDay = new Date(
        pickupDate.getFullYear(),
        pickupDate.getMonth(),
        pickupDate.getDate()
      );
      if (pickupDay > start) {
        start = pickupDay;
      }
    }
  }

  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + DEFAULT_LOAN_DAYS
  );
}

/**
 * Total deposit for a set of items: item deposit × copy count
 * (one copy per item unless requestedCopies says otherwise)
 */
export function calculateRentalDeposit(
  items: Pick<Item, 'id' | 'deposit'>[],
  requestedCopies?: InstanceData
): number {
  return items.reduce(
    (sum, item) => sum + (item.deposit || 0) * getCopyCount(requestedCopies, item.id),
    0
  );
}

export interface RentalTemplateData {
  customer?: Customer;
  items: Item[];
  /** Reservation pickup datetime, used for the default expected return date */
  pickup?: string;
  /** Explicit expected return date; takes precedence over the pickup rule */
  expectedOn?: string;
  remark?: string;
}

/**
 * Builds an unsaved rental (empty id) from already-loaded data. Dates are
 * local YYYY-MM-DD strings: a UTC ISO string would prefill yesterday
 * between midnight and the UTC offset (#66).
 */
export function buildRentalTemplate({
  customer,
  items,
  pickup,
  expectedOn,
  remark,
}: RentalTemplateData): RentalExpanded {
  const now = new Date();

  return {
    id: '',
    customer: customer?.id ?? '',
    items: items.map((item) => item.id),
    deposit: calculateRentalDeposit(items),
    deposit_back: 0,
    rented_on: dateToLocalString(now),
    returned_on: '',
    expected_on: expectedOn || dateToLocalString(getDefaultExpectedDate(pickup, now)),
    extended_on: '',
    remark: remark || '',
    employee: '',
    employee_back: '',
    created: '',
    updated: '',
    collectionId: '',
    collectionName: 'rental',
    expand: {
      customer,
      items,
    },
  } as RentalExpanded;
}

export interface RentalTemplateOptions {
  customerIid?: number;
  itemIids?: number[];
  reservationId?: string;
  /** Reservation pickup datetime, see getDefaultExpectedDate */
  pickup?: string;
  comments?: string;
}

/**
 * Creates a rental template by fetching customer and items from IIDs
 */
export async function createRentalTemplate(
  options: RentalTemplateOptions
): Promise<RentalExpanded | null> {
  const { customerIid, itemIids, pickup, comments } = options;

  try {
    let customer: Customer | undefined;
    let items: Item[] = [];

    // Fetch customer if IID provided
    if (customerIid) {
      try {
        customer = await collections
          .customers()
          .getFirstListItem<Customer>(`iid=${customerIid}`);
      } catch (err) {
        console.error('Error fetching customer:', err);
        // Continue without customer - user can select manually
      }
    }

    // Fetch items if IIDs provided
    if (itemIids && itemIids.length > 0) {
      try {
        items = await Promise.all(
          itemIids.map((iid) =>
            collections.items().getFirstListItem<Item>(`iid=${iid}`)
          )
        );
      } catch (err) {
        console.error('Error fetching items:', err);
        // Continue without items - user can select manually
      }
    }

    return buildRentalTemplate({ customer, items, pickup, remark: comments });
  } catch (err) {
    console.error('Error creating rental template:', err);
    return null;
  }
}
