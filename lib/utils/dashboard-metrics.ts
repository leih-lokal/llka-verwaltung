/**
 * Dashboard metrics calculation utilities
 * Provides utility functions for computing dashboard widget metrics
 */

import { startOfDay, endOfDay, parseISO, differenceInDays, addDays } from 'date-fns';
import type {
  RentalExpanded,
  Customer,
  Reservation,
  OverdueBreakdown,
  TodayActivityMetrics,
  DueThisWeekItem,
} from '@/types';
import { calculateDaysOverdue, calculateRentalStatus } from './formatting';
import { RentalStatus } from '@/types';

/**
 * Calculates overdue rental breakdown by severity
 * @param rentals - List of rental records (should be pre-filtered to active rentals)
 * @returns Breakdown of overdue rentals by severity level
 */
export function calculateOverdueBreakdown(
  rentals: RentalExpanded[]
): OverdueBreakdown {
  const breakdown: OverdueBreakdown = {
    severity1to3Days: 0,
    severity4to7Days: 0,
    severity8PlusDays: 0,
    total: 0,
  };

  rentals.forEach((rental) => {
    const status = calculateRentalStatus(
      rental.rented_on,
      rental.returned_on,
      rental.expected_on,
      rental.extended_on
    );

    if (status === RentalStatus.Overdue) {
      const daysOverdue = calculateDaysOverdue(
        rental.returned_on,
        rental.expected_on,
        rental.extended_on
      );

      if (daysOverdue >= 1 && daysOverdue <= 3) {
        breakdown.severity1to3Days++;
      } else if (daysOverdue >= 4 && daysOverdue <= 7) {
        breakdown.severity4to7Days++;
      } else if (daysOverdue >= 8) {
        breakdown.severity8PlusDays++;
      }

      breakdown.total++;
    }
  });

  return breakdown;
}

/**
 * Calculates today's activity metrics
 * @param rentals - All rental records
 * @param customers - All customer records
 * @param reservations - All reservation records
 * @returns Today's activity metrics
 */
export function calculateTodayMetrics(
  rentals: RentalExpanded[],
  customers: Customer[],
  reservations: Reservation[]
): TodayActivityMetrics {
  const today = new Date();
  const startOfToday = startOfDay(today);
  const endOfToday = endOfDay(today);

  // Count checkouts (rented_on = today)
  const checkouts = rentals.filter((rental) => {
    const rentedDate = parseISO(rental.rented_on);
    return rentedDate >= startOfToday && rentedDate <= endOfToday;
  }).length;

  // Count returns (returned_on = today)
  const returnsToday = rentals.filter((rental) => {
    if (!rental.returned_on) return false;
    const returnedDate = parseISO(rental.returned_on);
    return returnedDate >= startOfToday && returnedDate <= endOfToday;
  });

  const returns = returnsToday.length;

  // Separate on-time vs late returns
  let onTimeReturns = 0;
  let lateReturns = 0;

  returnsToday.forEach((rental) => {
    if (!rental.returned_on) return;

    const returnedDate = parseISO(rental.returned_on);
    const expectedDate = parseISO(rental.expected_on);

    // On-time if returned on or before expected date
    if (returnedDate <= expectedDate) {
      onTimeReturns++;
    } else {
      lateReturns++;
    }
  });

  // Count new customers registered today
  const newCustomers = customers.filter((customer) => {
    const registeredDate = parseISO(customer.registered_on);
    return registeredDate >= startOfToday && registeredDate <= endOfToday;
  }).length;

  // Count new reservations created today
  const newReservations = reservations.filter((reservation) => {
    const createdDate = parseISO(reservation.created);
    return createdDate >= startOfToday && createdDate <= endOfToday;
  }).length;

  return {
    checkouts,
    returns,
    onTimeReturns,
    lateReturns,
    newCustomers,
    newReservations,
  };
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
