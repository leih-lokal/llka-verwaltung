/**
 * Extend Dialog
 * Dialog for extending rental deadline with quick +7/+14 day buttons or custom date
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import type { RentalExpanded } from '@/types';
import { collections } from '@/lib/pocketbase/client';
import { toast } from 'sonner';
import { formatDate, formatFullName, dateToLocalString } from '@/lib/utils/formatting';
import { extendedDueDate } from '@/lib/utils/rental-extension';

interface ExtendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: RentalExpanded;
  onSuccess: () => void;
}

export function ExtendDialog({ open, onOpenChange, rental, onSuccess }: ExtendDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const customerName = rental.expand?.customer
    ? formatFullName(rental.expand.customer.firstname, rental.expand.customer.lastname)
    : 'Unbekannt';

  async function handleQuickExtend(days: number) {
    try {
      setIsSubmitting(true);

      // From today if already overdue, otherwise from the current due date
      const newExpectedDateStr = extendedDueDate(rental.expected_on, days);

      await collections.rentals().update(rental.id, {
        expected_on: newExpectedDateStr,
        extended_on: dateToLocalString(new Date()), // Track when extension was made
      });

      toast.success(`Neue Rückgabefrist: ${formatDate(newExpectedDateStr)}`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error extending rental:', error);
      toast.error('Fehler beim Verlängern');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCustomExtend() {
    if (!selectedDate) {
      toast.error('Bitte wählen Sie ein Datum');
      return;
    }

    try {
      setIsSubmitting(true);

      const newExpectedDateStr = dateToLocalString(selectedDate);

      await collections.rentals().update(rental.id, {
        expected_on: newExpectedDateStr,
        extended_on: dateToLocalString(new Date()),
      });

      toast.success(`Neue Rückgabefrist: ${formatDate(newExpectedDateStr)}`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error extending rental:', error);
      toast.error('Fehler beim Verlängern');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ausleihe verlängern</DialogTitle>
          <DialogDescription>
            Neue Rückgabefrist für {customerName} festlegen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Info */}
          <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Aktuelle Frist:</span>
              <span className="font-medium">{formatDate(rental.expected_on)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gegenstände:</span>
              <span className="font-medium">{rental.items.length}</span>
            </div>
          </div>

          {/* Quick Extend Buttons */}
          <div className="space-y-2">
            <Label>Schnellverlängerung</Label>
            <p className="text-xs text-muted-foreground">
              Ab der aktuellen Frist, bei überfälligen Ausleihen ab heute
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleQuickExtend(7)}
                disabled={isSubmitting}
                className="flex-1"
              >
                +7 Tage
              </Button>
              <Button
                variant="outline"
                onClick={() => handleQuickExtend(14)}
                disabled={isSubmitting}
                className="flex-1"
              >
                +14 Tage
              </Button>
            </div>
          </div>

          {/* Custom Date Picker */}
          <div className="space-y-2">
            <Label>Oder benutzerdefiniertes Datum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  disabled={isSubmitting}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? formatDate(dateToLocalString(selectedDate)) : 'Datum wählen'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleCustomExtend}
            disabled={isSubmitting || !selectedDate}
          >
            {isSubmitting ? 'Verlängern...' : 'Verlängern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
