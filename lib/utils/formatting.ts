/**
 * Formatting utilities for dates, currency, etc.
 */

import { format, formatDistance, differenceInDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { RentalStatus, type Rental } from '@/types';
import { getRentalReturnStatus } from './partial-returns';

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
 * Calculate rental status based on dates and partial returns
 * Overload for full rental object (preferred)
 */
export function calculateRentalStatus(rental: Rental): RentalStatus;
/**
 * Calculate rental status based on dates only (legacy)
 */
export function calculateRentalStatus(
  rented_on: string,
  returned_on: string | null | undefined,
  expected_on: string,
  extended_on?: string | null
): RentalStatus;
/**
 * Implementation
 */
export function calculateRentalStatus(
  rentalOrRentedOn: Rental | string,
  returned_on?: string | null,
  expected_on?: string,
  extended_on?: string | null
): RentalStatus {
  // Determine if we got a Rental object or individual fields
  let rental: Rental | null = null;
  let rentedOn: string;
  let returnedOn: string | null | undefined;
  let expectedOn: string;
  let extendedOn: string | null | undefined;

  if (typeof rentalOrRentedOn === 'object') {
    // New signature: full rental object
    rental = rentalOrRentedOn;
    rentedOn = rental.rented_on;
    returnedOn = rental.returned_on;
    expectedOn = rental.expected_on;
    extendedOn = rental.extended_on;
  } else {
    // Legacy signature: individual fields
    rentedOn = rentalOrRentedOn;
    returnedOn = returned_on;
    expectedOn = expected_on!;
    extendedOn = extended_on;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day

  // Check for partial returns first (only if we have the full rental object)
  if (rental && !returnedOn) {
    const returnStatus = getRentalReturnStatus(rental);
    if (returnStatus.isPartiallyReturned) {
      return RentalStatus.PartiallyReturned;
    }
  }

  // Already returned
  if (returnedOn) {
    const returnDate = parseISO(returnedOn);
    returnDate.setHours(0, 0, 0, 0);

    // Check if returned today
    if (returnDate.getTime() === today.getTime()) {
      return RentalStatus.ReturnedToday;
    }
    return RentalStatus.Returned;
  }

  // Use expected_on as the due date
  // Note: extended_on now represents when the extension was made, not the new deadline
  // The new deadline is stored in expected_on (which gets updated when extending)
  if (!expectedOn) {
    return RentalStatus.Active;
  }

  const dueDate = parseISO(expectedOn);
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

  // Use expected_on as the due date (extended_on is now just a timestamp)
  const dueDate = parseISO(expected_on);
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

/**
 * Convert Date to YYYY-MM-DD string in local timezone
 * Avoids timezone offset issues with toISOString()
 */
export function dateToLocalString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD string to Date in local timezone
 * Avoids timezone offset issues with Date constructor
 */
export function localStringToDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}
