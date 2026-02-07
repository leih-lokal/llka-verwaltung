/**
 * Booking grid toolbar with month navigation and stats
 */

'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookingStatus } from '@/types';
import type { BookingSlot } from '@/lib/utils/booking-grid';

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

interface BookingToolbarProps {
  year: number;
  month: number;
  bookingSlots: BookingSlot[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export function BookingToolbar({
  year,
  month,
  bookingSlots,
  onPrevMonth,
  onNextMonth,
  onToday,
}: BookingToolbarProps) {
  const stats = useMemo(() => {
    let reserved = 0;
    let active = 0;
    let overdue = 0;
    let returned = 0;
    const customers = new Set<string>();

    for (const slot of bookingSlots) {
      const s = slot.booking.status;
      if (s === BookingStatus.Reserved) reserved++;
      else if (s === BookingStatus.Active) active++;
      else if (s === BookingStatus.Overdue) overdue++;
      else if (s === BookingStatus.Returned) returned++;
      customers.add(slot.booking.customer_name);
    }

    return { total: bookingSlots.length, reserved, active, overdue, returned, customers: customers.size };
  }, [bookingSlots]);

  return (
    <div className="border-b-2 border-primary bg-background p-4 flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={onPrevMonth} aria-label="Vorheriger Monat">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={onNextMonth} aria-label="Nächster Monat">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={onToday}>
        Heute
      </Button>
      <h2 className="text-lg font-semibold ml-2">
        {MONTH_NAMES[month]} {year}
      </h2>

      {stats.total > 0 && (
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{stats.total}</span> Buchungen
          </span>
          <span className="text-border">|</span>
          <span>
            <span className="font-semibold text-foreground">{stats.customers}</span> Kund:innen
          </span>
          {stats.reserved > 0 && (
            <>
              <span className="text-border">|</span>
              <span>
                <span className="font-semibold" style={{ color: 'hsl(210 70% 40%)' }}>{stats.reserved}</span> reserviert
              </span>
            </>
          )}
          {stats.active > 0 && (
            <>
              <span className="text-border">|</span>
              <span>
                <span className="font-semibold" style={{ color: 'hsl(120 50% 35%)' }}>{stats.active}</span> aktiv
              </span>
            </>
          )}
          {stats.overdue > 0 && (
            <>
              <span className="text-border">|</span>
              <span>
                <span className="font-semibold" style={{ color: 'hsl(0 70% 40%)' }}>{stats.overdue}</span> überfällig
              </span>
            </>
          )}
          {stats.returned > 0 && (
            <>
              <span className="text-border">|</span>
              <span>
                <span className="font-semibold text-muted-foreground">{stats.returned}</span> abgeschlossen
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
