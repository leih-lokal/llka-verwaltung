/**
 * Bookings page — spreadsheet-like grid for managing protected item bookings
 */

'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, CalendarRange } from 'lucide-react';
import { useBookingGrid } from '@/hooks/use-booking-grid';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import { BookingToolbar } from '@/components/bookings/booking-toolbar';
import { BookingGrid } from '@/components/bookings/booking-grid';
import { CustomerPickerPopover } from '@/components/bookings/customer-picker-popover';
import { BookingDetailPopover } from '@/components/bookings/booking-detail-popover';
import { RentalDetailSheet } from '@/components/detail-sheets/rental-detail-sheet';
import { collections } from '@/lib/pocketbase/client';
import { BookingStatus } from '@/types';
import type { Booking, BookingExpanded, RentalExpanded, Customer } from '@/types';

/** Format a local Date as "YYYY-MM-DD 00:00:00.000Z" without UTC shift */
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day} 00:00:00.000Z`;
}

export default function BookingsPage() {
  const grid = useBookingGrid();

  // Customer picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pendingBooking, setPendingBooking] = useState<{
    columnKeys: string[];
    startDate: Date;
    endDate: Date;
  } | null>(null);

  // Detail popover state
  const [selectedBooking, setSelectedBooking] =
    useState<BookingExpanded | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAnchor, setDetailAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Rental sheet state (for converting bookings to rentals)
  const [rentalFromBooking, setRentalFromBooking] =
    useState<RentalExpanded | null>(null);
  const [isRentalSheetOpen, setIsRentalSheetOpen] = useState(false);

  // Realtime: refetch on any booking change
  useRealtimeSubscription<Booking>('booking', {
    onCreated: () => grid.refetch(),
    onUpdated: () => grid.refetch(),
    onDeleted: () => grid.refetch(),
  });

  const handleCreateBooking = useCallback(
    (
      columnKeys: string[],
      startDate: Date,
      endDate: Date,
      mousePosition: { x: number; y: number }
    ) => {
      setPendingBooking({ columnKeys, startDate, endDate });
      setPickerAnchor(mousePosition);
      setPickerOpen(true);
    },
    []
  );

  const handleCustomerSelected = useCallback(
    async (customer: Customer | null, manualName?: string) => {
      if (!pendingBooking) return;

      // Extract item ID from first column key (format: "itemId-copyIndex")
      const itemId = pendingBooking.columnKeys[0].split('-').slice(0, -1).join('-');
      const count = pendingBooking.columnKeys.length;

      const customerName = customer
        ? `${customer.firstname} ${customer.lastname}`
        : manualName || '';

      if (!customerName) {
        toast.error('Bitte einen Kundennamen eingeben');
        return;
      }

      try {
        const bookingData = {
          item: itemId,
          customer: customer?.id || '',
          customer_name: customerName,
          customer_phone: customer?.phone || '',
          customer_email: customer?.email || '',
          start_date: toDateString(pendingBooking.startDate),
          end_date: toDateString(pendingBooking.endDate),
          status: BookingStatus.Reserved,
        };

        // Create one booking per selected copy column
        await Promise.all(
          Array.from({ length: count }, () =>
            collections.bookings().create(bookingData)
          )
        );

        toast.success(
          count > 1
            ? `${count} Buchungen erstellt`
            : 'Buchung erstellt'
        );
        grid.refetch();
      } catch (err) {
        console.error('Error creating booking:', err);
        const message =
          (err instanceof Error ? err.message : null) ||
          'Fehler beim Erstellen der Buchung';
        toast.error(message);
      } finally {
        setPendingBooking(null);
      }
    },
    [pendingBooking, grid]
  );

  const handleBookingClick = useCallback(
    (booking: BookingExpanded, position: { x: number; y: number }) => {
      setSelectedBooking(booking);
      setDetailAnchor(position);
      setDetailOpen(true);
    },
    []
  );

  const handleConvertToRental = useCallback(
    async (booking: BookingExpanded) => {
      setDetailOpen(false);

      // Active or returned booking with linked rental → open that rental
      if (booking.associated_rental) {
        try {
          const rental = await collections
            .rentals()
            .getOne<RentalExpanded>(booking.associated_rental, {
              expand: 'customer,items',
            });
          setRentalFromBooking(rental);
          setIsRentalSheetOpen(true);
        } catch (err) {
          console.error('Error fetching linked rental:', err);
          toast.error('Zugehörige Ausleihe nicht gefunden');
        }
        return;
      }

      // Reserved booking → create a new rental pre-filled from booking
      const templateRental = {
        id: '',
        customer: booking.customer || '',
        items: [booking.item],
        deposit: 0,
        deposit_back: 0,
        rented_on: new Date().toISOString(),
        returned_on: '',
        expected_on: booking.end_date,
        extended_on: '',
        remark: booking.notes || '',
        employee: '',
        employee_back: '',
        created: '',
        updated: '',
        collectionId: '',
        collectionName: 'rental',
        expand: {
          customer: booking.expand?.customer || ({} as Customer),
          items: booking.expand?.item ? [booking.expand.item] : [],
        },
      } as RentalExpanded;

      if (booking.customer) {
        try {
          const customer = await collections
            .customers()
            .getOne<Customer>(booking.customer);
          templateRental.customer = customer.id;
          templateRental.expand.customer = customer;
        } catch (err) {
          console.error('Error fetching customer:', err);
        }
      }

      setRentalFromBooking(templateRental);
      setIsRentalSheetOpen(true);
    },
    []
  );

  const handleRentalSave = useCallback(() => {
    setIsRentalSheetOpen(false);
    setRentalFromBooking(null);
    grid.refetch();
  }, [grid]);

  if (grid.unsupported) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground p-8">
        <CalendarRange className="h-16 w-16 opacity-40" />
        <div className="text-center max-w-sm space-y-1">
          <p className="text-lg font-medium text-foreground">Buchungen nicht verfügbar</p>
          <p className="text-sm">
            Diese Funktion wird von deinem PocketBase-Server noch nicht unterstützt.
            Bitte erstelle eine <code className="bg-muted px-1 rounded text-xs">booking</code>-Collection, um Buchungen zu nutzen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <BookingToolbar
        year={grid.year}
        month={grid.month}
        bookingSlots={grid.bookingSlots}
        onPrevMonth={grid.prevMonth}
        onNextMonth={grid.nextMonth}
        onToday={grid.goToToday}
      />

      {grid.isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <BookingGrid
          dates={grid.dates}
          columns={grid.columns}
          bookingSlots={grid.bookingSlots}
          onCreateBooking={handleCreateBooking}
          onBookingClick={handleBookingClick}
        />
      )}

      <CustomerPickerPopover
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) setPendingBooking(null);
        }}
        anchorPosition={pickerAnchor}
        onSelect={handleCustomerSelected}
      />

      <BookingDetailPopover
        booking={selectedBooking}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        anchorPosition={detailAnchor}
        onChanged={() => grid.refetch()}
        onConvertToRental={handleConvertToRental}
      />

      <RentalDetailSheet
        rental={rentalFromBooking}
        open={isRentalSheetOpen}
        onOpenChange={setIsRentalSheetOpen}
        onSave={handleRentalSave}
        sourceBookingId={
          rentalFromBooking && !rentalFromBooking.id
            ? selectedBooking?.id
            : undefined
        }
      />
    </div>
  );
}
