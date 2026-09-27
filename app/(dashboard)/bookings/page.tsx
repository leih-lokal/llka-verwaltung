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
import { CreateBookingDialog } from '@/components/bookings/create-booking-dialog';
import { collections } from '@/lib/pocketbase/client';
import { createBookings, BookingConflictError } from '@/lib/api/bookings';
import { buildRentalTemplate } from '@/lib/utils/rental-template';
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
    /** Item ID resolved from column lookup */
    itemId: string;
    /** Total copies for multi-copy items (shows quantity picker) */
    maxCopies?: number;
  } | null>(null);

  // Detail popover state
  const [selectedBooking, setSelectedBooking] =
    useState<BookingExpanded | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAnchor, setDetailAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Create booking dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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
      const col = grid.columns.find((c) => c.key === columnKeys[0]);
      if (!col) return;
      setPendingBooking({
        columnKeys,
        startDate,
        endDate,
        itemId: col.item.id,
        maxCopies: col.totalCopies > 1 ? col.totalCopies : undefined,
      });
      setPickerAnchor(mousePosition);
      setPickerOpen(true);
    },
    [grid.columns]
  );

  const handleCustomerSelected = useCallback(
    async (customer: Customer | null, manualName?: string, quantity?: number) => {
      if (!pendingBooking) return;

      const itemId = pendingBooking.itemId;
      const count = quantity ?? pendingBooking.columnKeys.length;

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

        // One booking per copy; refused if the copies aren't free
        const item = grid.items.find((i) => i.id === itemId);
        await createBookings(bookingData, count, item?.copies);

        toast.success(
          count > 1
            ? `${count} Buchungen erstellt`
            : 'Buchung erstellt'
        );
        grid.refetch();
      } catch (err) {
        if (!(err instanceof BookingConflictError)) {
          console.error('Error creating booking:', err);
        }
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
      let customer = booking.expand?.customer;
      if (booking.customer) {
        try {
          customer = await collections
            .customers()
            .getOne<Customer>(booking.customer);
        } catch (err) {
          console.error('Error fetching customer:', err);
        }
      }

      const templateRental = buildRentalTemplate({
        customer,
        items: booking.expand?.item ? [booking.expand.item] : [],
        expectedOn: booking.end_date,
        remark: booking.notes,
      });

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
        onCreateNew={() => setCreateDialogOpen(true)}
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
        maxCopies={pendingBooking?.maxCopies}
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

      <CreateBookingDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        items={grid.items}
        onCreated={() => {
          setCreateDialogOpen(false);
          grid.refetch();
        }}
      />
    </div>
  );
}
