/**
 * Hook for managing booking grid data: fetches protected items and bookings
 * for the current month, runs lane assignment, exposes month navigation.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collections } from '@/lib/pocketbase/client';
import type { BookingExpanded, Item } from '@/types';
import {
  generateMonthDates,
  buildItemColumns,
  assignBookingsToLanes,
  type ItemColumn,
  type BookingSlot,
} from '@/lib/utils/booking-grid';

interface UseBookingGridReturn {
  /** All dates in the current month */
  dates: Date[];
  /** Item columns (one per item × copy) */
  columns: ItemColumn[];
  /** Bookings positioned in lanes */
  bookingSlots: BookingSlot[];
  /** Current year */
  year: number;
  /** Current month (0-indexed) */
  month: number;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether the booking collection is missing on the server */
  unsupported: boolean;
  /** Navigate to previous month */
  prevMonth: () => void;
  /** Navigate to next month */
  nextMonth: () => void;
  /** Navigate to current month */
  goToToday: () => void;
  /** Refetch data for current month */
  refetch: () => void;
}

export function useBookingGrid(): UseBookingGridReturn {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [items, setItems] = useState<Item[]>([]);
  const [bookings, setBookings] = useState<BookingExpanded[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unsupported, setUnsupported] = useState(false);

  const dates = useMemo(() => generateMonthDates(year, month), [year, month]);
  const columns = useMemo(() => buildItemColumns(items), [items]);
  const bookingSlots = useMemo(
    () => assignBookingsToLanes(bookings, items),
    [bookings, items]
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const lastDate = new Date(year, month + 1, 0).getDate();
      const mm = pad(month + 1);

      const firstDayStr = `${year}-${mm}-01 00:00:00.000Z`;
      const lastDayStr = `${year}-${mm}-${pad(lastDate)} 23:59:59.999Z`;

      // Fetch protected items and bookings in parallel
      const [itemsResult, bookingsResult] = await Promise.all([
        collections.items().getFullList<Item>({
          filter: "is_protected=true && status!='deleted'",
          sort: 'iid',
        }),
        collections.bookings().getFullList<BookingExpanded>({
          filter: `start_date<='${lastDayStr}' && end_date>='${firstDayStr}'`,
          sort: 'start_date',
          expand: 'item,customer',
        }),
      ]);

      setItems(itemsResult);
      setBookings(bookingsResult);
    } catch (err) {
      // Detect missing collection (404 or "not found" from PocketBase)
      if (
        err &&
        typeof err === 'object' &&
        'status' in err &&
        (err as { status: number }).status === 404
      ) {
        setUnsupported(true);
      } else {
        console.error('Error fetching booking grid data:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevMonth = useCallback(() => {
    setMonth((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setMonth((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }, []);

  return {
    dates,
    columns,
    bookingSlots,
    year,
    month,
    isLoading,
    unsupported,
    prevMonth,
    nextMonth,
    goToToday,
    refetch: fetchData,
  };
}
