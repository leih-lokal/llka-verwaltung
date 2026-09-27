/**
 * Overdue severity: the one definition used by the overdue page and the
 * dashboard's overdue widget
 */

import { RentalStatus, type Rental } from '@/types';
import { calculateDaysOverdue, calculateRentalStatus } from './formatting';

/** Severity buckets for unreturned rentals, most urgent first */
export type OverdueSeverity =
  | 'severely_critical'
  | 'critical'
  | 'overdue'
  | 'due_today'
  | 'due_soon';

/** The buckets for rentals that are past due */
export type OverdueLevel = Extract<OverdueSeverity, 'severely_critical' | 'critical' | 'overdue'>;

// Thresholds are the overdue page's (7+ / 3-6 / 1-2 days). The dashboard
// widget used 1-3 / 4-7 / 8+ before and now shares these.
/** Days overdue from which a rental is severely critical */
export const SEVERELY_CRITICAL_DAYS = 7;
/** Days overdue from which a rental is critical */
export const CRITICAL_DAYS = 3;
/** Rentals due within this many days are "due soon" */
export const DUE_SOON_DAYS = 3;

/** Day range of each overdue level, for labels */
export const OVERDUE_LEVEL_DAYS: Record<OverdueLevel, string> = {
  severely_critical: `${SEVERELY_CRITICAL_DAYS}+ Tage`,
  critical: `${CRITICAL_DAYS}-${SEVERELY_CRITICAL_DAYS - 1} Tage`,
  overdue: `1-${CRITICAL_DAYS - 1} Tage`,
};

type RentalDates = Pick<Rental, 'rented_on' | 'returned_on' | 'expected_on' | 'extended_on'>;

/**
 * Severity bucket of a rental, or null if it is returned or not due within
 * DUE_SOON_DAYS
 */
export function getOverdueSeverity(rental: RentalDates): OverdueSeverity | null {
  const status = calculateRentalStatus(
    rental.rented_on,
    rental.returned_on,
    rental.expected_on,
    rental.extended_on
  );
  const daysOverdue = calculateDaysOverdue(
    rental.returned_on,
    rental.expected_on,
    rental.extended_on
  );

  if (status === RentalStatus.Overdue) {
    if (daysOverdue >= SEVERELY_CRITICAL_DAYS) return 'severely_critical';
    if (daysOverdue >= CRITICAL_DAYS) return 'critical';
    return 'overdue';
  }
  if (status === RentalStatus.DueToday) return 'due_today';
  if (status === RentalStatus.Active && daysOverdue < 0 && daysOverdue >= -DUE_SOON_DAYS) {
    return 'due_soon';
  }
  return null;
}

/** Number of overdue rentals per level */
export type OverdueCounts = Record<OverdueLevel, number> & { total: number };
