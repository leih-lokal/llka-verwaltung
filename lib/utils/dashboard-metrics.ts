/**
 * Dashboard metrics calculation utilities
 * Provides utility functions for computing dashboard widget metrics
 */

import { parseISO, differenceInDays, addDays } from 'date-fns';
import type { RentalExpanded, DueThisWeekItem } from '@/types';
import { getOverdueSeverity, type OverdueCounts } from './overdue';

/**
 * Calculates overdue rental breakdown by severity (see getOverdueSeverity)
 * @param rentals - List of rental records (should be pre-filtered to active rentals)
 * @returns Breakdown of overdue rentals by severity level
 */
export function calculateOverdueBreakdown(
  rentals: RentalExpanded[]
): OverdueCounts {
  const breakdown: OverdueCounts = {
    overdue: 0,
    critical: 0,
    severely_critical: 0,
    total: 0,
  };

  rentals.forEach((rental) => {
    const severity = getOverdueSeverity(rental);
    if (
      severity === 'overdue' ||
      severity === 'critical' ||
      severity === 'severely_critical'
    ) {
      breakdown[severity]++;
      breakdown.total++;
    }
  });

  return breakdown;
}

/**
 * Gets rentals due within a specified number of days
 * @param rentals - List of active rentals
 * @param days - Number of days to look ahead (e.g., 7 for one week)
 * @returns List of rentals due within the time window, sorted by due date
 */
export function getRentalsDueInDays(
  rentals: RentalExpanded[],
  days: number
): DueThisWeekItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = addDays(today, days);
  endDate.setHours(23, 59, 59, 999);

  const dueItems: DueThisWeekItem[] = [];

  rentals.forEach((rental) => {
    // Skip returned rentals
    if (rental.returned_on) return;

    const expectedDate = parseISO(rental.expected_on);
    expectedDate.setHours(0, 0, 0, 0);

    // Check if due date is within the window
    if (expectedDate >= today && expectedDate <= endDate) {
      const daysUntilDue = differenceInDays(expectedDate, today);
      const customerName = rental.expand?.customer
        ? `${rental.expand.customer.firstname} ${rental.expand.customer.lastname}`
        : 'Unbekannt';

      dueItems.push({
        rental,
        dueDate: rental.expected_on,
        daysUntilDue,
        customerName,
        itemCount: rental.items?.length || 0,
      });
    }
  });

  // Sort by due date (earliest first)
  dueItems.sort((a, b) => {
    const dateA = parseISO(a.dueDate);
    const dateB = parseISO(b.dueDate);
    return dateA.getTime() - dateB.getTime();
  });

  return dueItems;
}
