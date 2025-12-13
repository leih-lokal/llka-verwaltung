/**
 * Utility functions for creating rental templates from reservations
 */

import { collections } from '@/lib/pocketbase/client';
import type { RentalExpanded, Customer, Item } from '@/types';

export interface RentalTemplateOptions {
  customerIid?: number;
  itemIids?: number[];
  reservationId?: string;
  comments?: string;
}

/**
 * Creates a rental template by fetching customer and items from IIDs
 */
export async function createRentalTemplate(
  options: RentalTemplateOptions
): Promise<RentalExpanded | null> {
  const { customerIid, itemIids, reservationId, comments } = options;

  try {
    const template: any = {
      id: '',
      customer: '',
      items: [],
      deposit: 0,
      deposit_back: 0,
      rented_on: new Date().toISOString(),
      returned_on: '',
      expected_on: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      extended_on: '',
      remark: comments || '',
      employee: '',
      employee_back: '',
      created: '',
      updated: '',
      collectionId: '',
      collectionName: 'rental',
      expand: {
        items: [],
      },
    };

    // Fetch customer if IID provided
    if (customerIid) {
      try {
        const customer = await collections
          .customers()
          .getFirstListItem<Customer>(`iid=${customerIid}`);
        template.customer = customer.id;
        template.expand.customer = customer;
      } catch (err) {
        console.error('Error fetching customer:', err);
        // Continue without customer - user can select manually
      }
    }

    // Fetch items if IIDs provided
    if (itemIids && itemIids.length > 0) {
      try {
        const items = await Promise.all(
          itemIids.map((iid) =>
            collections.items().getFirstListItem<Item>(`iid=${iid}`)
          )
        );
        template.items = items.map((item) => item.id);
        template.expand.items = items;

        // Calculate total deposit
        template.deposit = items.reduce((sum, item) => sum + (item.deposit || 0), 0);
      } catch (err) {
        console.error('Error fetching items:', err);
        // Continue without items - user can select manually
      }
    }

    return template as RentalExpanded;
  } catch (err) {
    console.error('Error creating rental template:', err);
    return null;
  }
}
