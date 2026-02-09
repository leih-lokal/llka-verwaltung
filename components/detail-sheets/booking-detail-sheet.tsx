/**
 * Booking Detail Sheet Component
 * Displays and edits booking information
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  SaveIcon,
  Trash2Icon,
  PlayIcon,
  RotateCcwIcon,
  XCircleIcon,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { collections } from '@/lib/pocketbase/client';
import { BookingStatus } from '@/types';
import type { Booking, BookingExpanded } from '@/types';
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_TEXT_COLORS,
} from '@/lib/constants/statuses';

const bookingSchema = z.object({
  customer_name: z.string().min(1, 'Name ist erforderlich'),
  customer_phone: z.string().optional(),
  customer_email: z
    .string()
    .email('Ungültige E-Mail-Adresse')
    .optional()
    .or(z.literal('')),
  start_date: z.string().min(1, 'Startdatum ist erforderlich'),
  end_date: z.string().min(1, 'Enddatum ist erforderlich'),
  notes: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

interface BookingDetailSheetProps {
  booking: BookingExpanded | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function BookingDetailSheet({
  booking,
  open,
  onOpenChange,
  onSave,
}: BookingDetailSheetProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      start_date: '',
      end_date: '',
      notes: '',
    },
  });

  // Reset form when booking changes
  useEffect(() => {
    if (booking) {
      form.reset({
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone || '',
        customer_email: booking.customer_email || '',
        start_date: booking.start_date.split(' ')[0] || booking.start_date.split('T')[0],
        end_date: booking.end_date.split(' ')[0] || booking.end_date.split('T')[0],
        notes: booking.notes || '',
      });
    }
  }, [booking, form]);

  const handleSave = async (values: BookingFormValues) => {
    if (!booking) return;
    setIsSaving(true);
    try {
      await collections.bookings().update(booking.id, {
        customer_name: values.customer_name,
        customer_phone: values.customer_phone || '',
        customer_email: values.customer_email || '',
        start_date: values.start_date + ' 00:00:00.000Z',
        end_date: values.end_date + ' 00:00:00.000Z',
        notes: values.notes || '',
      });
      toast.success('Buchung gespeichert');
      onSave?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving booking:', err);
      toast.error('Fehler beim Speichern der Buchung');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: BookingStatus) => {
    if (!booking) return;
    setIsSaving(true);
    try {
      await collections.bookings().update(booking.id, { status: newStatus });
      toast.success(`Status geändert: ${BOOKING_STATUS_LABELS[newStatus]}`);
      onSave?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating booking status:', err);
      const message =
        (err instanceof Error ? err.message : null) ||
        'Fehler beim Ändern des Status';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!booking) return;
    setIsSaving(true);
    try {
      // Find all sibling records (same item + customer + dates = one logical group)
      const siblings = await collections.bookings().getFullList<Booking>({
        filter: `item='${booking.item}' && customer_name='${booking.customer_name}' && start_date='${booking.start_date}' && end_date='${booking.end_date}'`,
      });
      await Promise.all(
        siblings.map((s) => collections.bookings().delete(s.id))
      );
      toast.success(
        siblings.length > 1
          ? `${siblings.length} Buchungen gelöscht`
          : 'Buchung gelöscht'
      );
      onSave?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Error deleting booking:', err);
      toast.error('Fehler beim Löschen der Buchung');
    } finally {
      setIsSaving(false);
      setDeleteDialogOpen(false);
    }
  };

  if (!booking) return null;

  const status = booking.status as BookingStatus;
  const itemName = booking.expand?.item?.name || 'Unbekannt';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Buchung bearbeiten</SheetTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                style={{
                  backgroundColor: BOOKING_STATUS_COLORS[status],
                  color: BOOKING_STATUS_TEXT_COLORS[status],
                }}
              >
                {BOOKING_STATUS_LABELS[status]}
              </Badge>
              <span className="text-sm text-muted-foreground">{itemName}</span>
            </div>
          </SheetHeader>

          <form
            onSubmit={form.handleSubmit(handleSave)}
            className="flex flex-col gap-4 px-4 flex-1"
          >
            {/* Customer Name */}
            <div className="space-y-2">
              <Label htmlFor="customer_name">Name *</Label>
              <Input
                id="customer_name"
                {...form.register('customer_name')}
                placeholder="Kundenname"
              />
              {form.formState.errors.customer_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.customer_name.message}
                </p>
              )}
            </div>

            {/* Customer Phone */}
            <div className="space-y-2">
              <Label htmlFor="customer_phone">Telefon</Label>
              <Input
                id="customer_phone"
                {...form.register('customer_phone')}
                placeholder="Telefonnummer"
              />
            </div>

            {/* Customer Email */}
            <div className="space-y-2">
              <Label htmlFor="customer_email">E-Mail</Label>
              <Input
                id="customer_email"
                type="email"
                {...form.register('customer_email')}
                placeholder="E-Mail-Adresse"
              />
              {form.formState.errors.customer_email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.customer_email.message}
                </p>
              )}
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start_date">Startdatum *</Label>
              <Input
                id="start_date"
                type="date"
                {...form.register('start_date')}
              />
              {form.formState.errors.start_date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.start_date.message}
                </p>
              )}
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="end_date">Enddatum *</Label>
              <Input
                id="end_date"
                type="date"
                {...form.register('end_date')}
              />
              {form.formState.errors.end_date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.end_date.message}
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notizen</Label>
              <Textarea
                id="notes"
                {...form.register('notes')}
                placeholder="Interne Notizen..."
                rows={3}
              />
            </div>

            {/* Status Transition Buttons */}
            <div className="space-y-2">
              <Label>Status ändern</Label>
              <div className="flex flex-wrap gap-2">
                {status === BookingStatus.Reserved && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleStatusChange(BookingStatus.Active)}
                      disabled={isSaving}
                    >
                      <PlayIcon className="h-3 w-3 mr-1" />
                      Aktivieren
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleStatusChange(BookingStatus.Returned)}
                      disabled={isSaving}
                    >
                      <XCircleIcon className="h-3 w-3 mr-1" />
                      Stornieren
                    </Button>
                  </>
                )}
                {status === BookingStatus.Active && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleStatusChange(BookingStatus.Returned)}
                    disabled={isSaving}
                  >
                    <RotateCcwIcon className="h-3 w-3 mr-1" />
                    Zurückgeben
                  </Button>
                )}
                {status === BookingStatus.Overdue && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleStatusChange(BookingStatus.Returned)}
                    disabled={isSaving}
                  >
                    <RotateCcwIcon className="h-3 w-3 mr-1" />
                    Zurückgeben
                  </Button>
                )}
              </div>
            </div>

            <SheetFooter className="px-0 mt-auto">
              <div className="flex justify-between w-full">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isSaving}
                >
                  <Trash2Icon className="h-3 w-3 mr-1" />
                  Löschen
                </Button>
                <Button type="submit" size="sm" disabled={isSaving}>
                  <SaveIcon className="h-3 w-3 mr-1" />
                  Speichern
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buchung löschen?</DialogTitle>
            <DialogDescription>
              Möchtest du die Buchung für &quot;{booking.customer_name}&quot; wirklich
              löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
