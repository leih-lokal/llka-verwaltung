/**
 * Due date for extending a rental
 */

import { addDays } from 'date-fns';
import { dateToLocalString, localStringToDate, toBusinessDay } from './formatting';

/**
 * New expected_on (YYYY-MM-DD) when extending a rental by `days` calendar days.
 *
 * Counts from the later of today and the current due date: counting from the
 * old due date would leave e.g. a rental 20 days overdue still overdue after
 * "+7 Tage". Days are compared in the business time zone, like the rental
 * status.
 */
export function extendedDueDate(
  expectedOn: string | null | undefined,
  days: number,
  now: Date = new Date()
): string {
  const today = toBusinessDay(now);
  const due = toBusinessDay(expectedOn);
  // YYYY-MM-DD strings compare chronologically
  const base = due > today ? due : today;
  return dateToLocalString(addDays(localStringToDate(base), days));
}
