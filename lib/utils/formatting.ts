/**
 * Formatting utilities for dates, currency, etc.
 */

import { format, formatDistance, differenceInCalendarDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { parsePhoneNumberFromString, type CountryCode, type PhoneNumber } from 'libphonenumber-js/min';
import { RentalStatus, type Rental } from '@/types';
import { getRentalReturnStatus } from './partial-returns';

const DEFAULT_PHONE_COUNTRY: CountryCode = 'DE';

/**
 * Time zone the library operates in. Rental status compares date-only fields
 * (expected_on, returned_on) as calendar days in this zone, so the result
 * doesn't depend on the browser's time zone.
 */
export const BUSINESS_TIME_ZONE = 'Europe/Berlin';

const businessDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Calendar day (YYYY-MM-DD) of a date value in BUSINESS_TIME_ZONE.
 * PocketBase stores date-only values as UTC midnight ("2026-04-15 00:00:00.000Z",
 * what dateToLocalString() writes); older records carry local midnight in UTC
 * ("2026-04-14 22:00:00.000Z"). Both map to 2026-04-15. Plain "YYYY-MM-DD"
 * strings are returned as-is. Returns '' for empty or unparseable input.
 */
export function toBusinessDay(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(
    businessDayFormatter.formatToParts(date).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parsePhone(phone: string, country: CountryCode): PhoneNumber | undefined {
  const trimmed = phone?.trim();
  return trimmed ? parsePhoneNumberFromString(trimmed, country) : undefined;
}

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
 */
export function calculateRentalStatus(rental: Rental): RentalStatus {
  const { returned_on: returnedOn, expected_on: expectedOn } = rental;
  const today = toBusinessDay(new Date());

  // Already returned
  if (returnedOn) {
    if (toBusinessDay(returnedOn) === today) {
      return RentalStatus.ReturnedToday;
    }
    return RentalStatus.Returned;
  }

  // Use expected_on as the due date
  // Note: extended_on now represents when the extension was made, not the new deadline
  // The new deadline is stored in expected_on (which gets updated when extending)
  const dueDay = toBusinessDay(expectedOn);

  // YYYY-MM-DD strings compare chronologically
  if (dueDay && dueDay < today) {
    return RentalStatus.Overdue;
  }

  if (dueDay && dueDay === today) {
    return RentalStatus.DueToday;
  }

  // Partial returns replace "active" only: an overdue or due-today rental
  // stays overdue / due today even if some items are back, so overdue lists
  // and counters keep it.
  return getRentalReturnStatus(rental).isPartiallyReturned
    ? RentalStatus.PartiallyReturned
    : RentalStatus.Active;
}

/**
 * Calculate days overdue (negative if not yet due)
 */
export function calculateDaysOverdue(
  returned_on: string | null | undefined,
  expected_on: string
): number {
  // If already returned, no overdue
  if (returned_on) {
    return 0;
  }

  // Use expected_on as the due date (extended_on is now just a timestamp)
  const dueDay = toBusinessDay(expected_on);
  if (!dueDay) {
    return 0;
  }

  return differenceInCalendarDays(
    localStringToDate(toBusinessDay(new Date())),
    localStringToDate(dueDay)
  );
}

/**
 * Format a phone number for display. Falls back to the raw input if unparseable.
 */
export function formatPhoneNumber(
  phone: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY
): string {
  if (!phone?.trim()) return '';
  return parsePhone(phone, defaultCountry)?.formatInternational() ?? phone;
}

/**
 * E.164 form for use in `tel:` hrefs. Falls back to the raw input if unparseable.
 */
export function formatPhoneNumberForTel(
  phone: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY
): string {
  if (!phone?.trim()) return '';
  return parsePhone(phone, defaultCountry)?.number ?? phone;
}

/**
 * Empty input is treated as valid (the field is optional).
 */
export function isValidPhoneNumber(
  phone: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY
): boolean {
  if (!phone?.trim()) return true;
  return parsePhone(phone, defaultCountry)?.isValid() ?? false;
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
