/**
 * Formatting utilities for dates, currency, etc.
 */

import { format, formatDistance, differenceInDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { RentalStatus } from '@/types';

/**
 * Format date to German locale
 */
export function formatDate(
  date: string | Date,
  formatStr: string = 'dd.MM.yyyy'
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatStr, { locale: de });
  } catch {
    return '';
  }
}

/**
 * Format date with time
 */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd.MM.yyyy HH:mm');
}

/**
 * Format relative time (e.g., "vor 2 Tagen")
 */
export function formatRelativeTime(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatDistance(dateObj, new Date(), {
      addSuffix: true,
      locale: de,
    });
  } catch {
    return '';
  }
}

/**
 * Format currency to EUR
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Calculate rental status based on dates
 */
export function calculateRentalStatus(
  rented_on: string,
  returned_on: string | null | undefined,
  expected_on: string,
  extended_on?: string | null
): RentalStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day

  // Already returned
  if (returned_on) {
    const returnDate = parseISO(returned_on);
    returnDate.setHours(0, 0, 0, 0);

    // Check if returned today
    if (returnDate.getTime() === today.getTime()) {
      return RentalStatus.ReturnedToday;
    }
    return RentalStatus.Returned;
  }

  // Use extended date if available, otherwise expected date
  const dueDate = parseISO(extended_on || expected_on);
  dueDate.setHours(0, 0, 0, 0);

  const daysUntilDue = differenceInDays(dueDate, today);

  if (daysUntilDue < 0) {
    return RentalStatus.Overdue;
  }

  if (daysUntilDue === 0) {
    return RentalStatus.DueToday;
  }

  return RentalStatus.Active;
}

/**
 * Calculate days overdue (negative if not yet due)
 */
export function calculateDaysOverdue(
  returned_on: string | null | undefined,
  expected_on: string,
  extended_on?: string | null
): number {
  // If already returned, no overdue
  if (returned_on) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = parseISO(extended_on || expected_on);
  dueDate.setHours(0, 0, 0, 0);

  return differenceInDays(today, dueDate);
}

/**
 * Format phone number (German format)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format as German phone number
  if (cleaned.length === 11 && cleaned.startsWith('49')) {
    // +49 123 45678910 -> +49 123 456 789 10
    return `+49 ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 11)}`;
  }

  if (cleaned.length === 10) {
    // 0123456789 -> 0123 456 789
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }

  return phone;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Get initials from name
 */
export function getInitials(firstname: string, lastname: string): string {
  return `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase();
}

/**
 * Format full name
 */
export function formatFullName(firstname: string, lastname: string): string {
  return `${firstname} ${lastname}`;
}
