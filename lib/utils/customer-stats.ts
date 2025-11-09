/**
 * Utility functions for fetching and computing customer statistics
 */

import { collections } from '@/lib/pocketbase/client';
import type { Customer, CustomerWithStats, CustomerRentals } from '@/types';

/**
 * Enriches an array of customers with their rental statistics
 * from the customer_rentals view
 *
 * @param customers - Array of customers to enrich
 * @returns Array of customers with stats added
 */
export async function enrichCustomersWithStats(
  customers: Customer[]
): Promise<CustomerWithStats[]> {
  if (customers.length === 0) {
    return [];
  }

  try {
    // Build filter to get stats for all customer IDs
    const customerIds = customers.map(c => `id='${c.id}'`).join('||');

    // Fetch rental stats from the customer_rentals view
    const statsRecords = await collections.customerRentals().getFullList<CustomerRentals>({
      filter: customerIds,
      fields: 'id,num_rentals,num_active_rentals',
    });

    // Create a map for quick lookup
    const statsMap = new Map<string, CustomerRentals>();
    for (const stat of statsRecords) {
      statsMap.set(stat.id, stat);
    }

    // Enrich customers with their stats
    return customers.map(customer => {
      const stats = statsMap.get(customer.id);
      return {
        ...customer,
        active_rentals: stats?.num_active_rentals || 0,
        total_rentals: stats?.num_rentals || 0,
      };
    });
  } catch (err) {
    console.error('Error fetching customer stats:', err);
    // On error, return customers with zero stats
    return customers.map(customer => ({
      ...customer,
      active_rentals: 0,
      total_rentals: 0,
    }));
  }
}
