/**
 * Sequential Mode - Step 3: Finalization
 * Date selection, identity confirmation, and rental creation
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { useSequentialMode } from '@/hooks/use-sequential-mode';
import { useIdentity } from '@/hooks/use-identity';
import { collections } from '@/lib/pocketbase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { dateToLocalString } from '@/lib/utils/formatting';
import type { InstanceData } from '@/lib/utils/instance-data';
import type { Rental } from '@/types';

export function FinalizeStep({ onSuccess }: { onSuccess: () => void }) {
  const {
    selectedCustomer,
    selectedItems,
    expectedDate,
    setExpectedDate,
    employee,
    setEmployee,
    goNext,
  } = useSequentialMode();

  const { currentIdentity } = useIdentity();
  const [isCreating, setIsCreating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [localEmployee, setLocalEmployee] = useState('');
  const employeeInputRef = useRef<HTMLInputElement>(null);

  // Initialize employee from identity or stored value
  useEffect(() => {
    if (currentIdentity && !employee) {
      setEmployee(currentIdentity);
      setLocalEmployee(currentIdentity);
    } else if (employee) {
      setLocalEmployee(employee);
    }
  }, [currentIdentity, employee, setEmployee]);

  // Focus employee input if no identity is set
  useEffect(() => {
    if (!currentIdentity && !employee) {
      setTimeout(() => employeeInputRef.current?.focus(), 100);
    }
  }, [currentIdentity, employee]);

  // Quick date setters
  const setWeeksFromNow = (weeks: number) => {
    const date = new Date();
    date.setDate(date.getDate() + weeks * 7);
    setExpectedDate(date);
    setShowDatePicker(false);
  };

  // Handle rental creation
  const handleCreateRental = async () => {
    // Validation
    if (!selectedCustomer) {
      toast.error('Bitte Nutzer auswählen');
      return;
    }

    if (selectedItems.length === 0) {
      toast.error('Bitte mindestens einen Artikel hinzufügen');
      return;
    }

    if (!localEmployee.trim()) {
      toast.error('Bitte Mitarbeiter-Kürzel eingeben');
      employeeInputRef.current?.focus();
      return;
    }

    setIsCreating(true);

    try {
      // Build instance data from selected items
      const instanceData: InstanceData = {};
      selectedItems.forEach(({ item, quantity }) => {
        if (quantity > 1) {
          instanceData[item.id] = quantity;
        }
      });

      // Calculate total deposit
      const totalDeposit = selectedItems.reduce(
        (sum, { item, quantity }) => sum + (item.deposit || 0) * quantity,
        0
      );

      // Prepare rental data
      const rentalData: Partial<Rental> = {
        customer: selectedCustomer.id,
        items: selectedItems.map(({ item }) => item.id),
        requested_copies: Object.keys(instanceData).length > 0 ? instanceData : undefined,
        deposit: totalDeposit,
        deposit_back: 0,
        rented_on: dateToLocalString(new Date()),
        expected_on: dateToLocalString(expectedDate),
        employee: localEmployee.trim(),
      };

      // Create rental
      await collections.rentals().create<Rental>(rentalData);

      // Update employee in context (but don't save to identity picker)
      setEmployee(localEmployee.trim());

      toast.success('Leihvorgang erfolgreich erstellt');
      onSuccess();
      goNext(); // Move to summary step
    } catch (err) {
      console.error('Error creating rental:', err);
      toast.error('Fehler beim Erstellen der Ausleihe');
    } finally {
      setIsCreating(false);
    }
  };

  // Format date for display
  const formatDateDisplay = (date: Date): string => {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-8">
        {/* Date Selection */}
        <div>
          <Label className="text-lg font-semibold mb-4 block">Zurückerwartet am:</Label>
          <div className="space-y-4">
            {/* Quick action buttons */}
            <div className="grid grid-cols-3 gap-4">
              <Button
                type="button"
                onClick={() => setWeeksFromNow(1)}
                size="lg"
                variant={
                  Math.abs(expectedDate.getTime() - new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).getTime()) < 1000
                    ? 'default'
                    : 'outline'
                }
                className="h-20 text-xl font-semibold"
              >
                +1 Woche
              </Button>
              <Button
                type="button"
                onClick={() => setWeeksFromNow(2)}
                size="lg"
                variant={
                  Math.abs(expectedDate.getTime() - new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).getTime()) < 1000
                    ? 'default'
                    : 'outline'
                }
                className="h-20 text-xl font-semibold"
              >
                +2 Wochen
              </Button>
              <Button
                type="button"
                onClick={() => setWeeksFromNow(3)}
                size="lg"
                variant={
                  Math.abs(expectedDate.getTime() - new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).getTime()) < 1000
                    ? 'default'
                    : 'outline'
                }
                className="h-20 text-xl font-semibold"
              >
                +3 Wochen
              </Button>
            </div>

            {/* Date picker */}
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className={cn(
                    'w-full h-14 text-lg justify-start font-normal',
                    !expectedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-5 w-5" />
                  {expectedDate ? formatDateDisplay(expectedDate) : 'Datum auswählen'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setExpectedDate(date);
                      setShowDatePicker(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Employee/Identity */}
        <div>
          <Label htmlFor="employee" className="text-lg font-semibold mb-4 block">
            Mitarbeiter-Kürzel:
          </Label>
          <div className="space-y-2">
            <Input
              ref={employeeInputRef}
              id="employee"
              value={localEmployee}
              onChange={(e) => setLocalEmployee(e.target.value)}
              placeholder="z.B. AB"
              className="h-14 text-xl"
              autoComplete="off"
            />
            {!currentIdentity && (
              <p className="text-sm text-muted-foreground">
                Das Kürzel wird nur für diese Ausleihe verwendet
              </p>
            )}
            {currentIdentity && currentIdentity !== localEmployee && (
              <p className="text-sm text-amber-600">
                Abweichend von aktueller Identität ({currentIdentity})
              </p>
            )}
          </div>
        </div>

        {/* Summary info */}
        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nutzer:</span>
            <span className="font-semibold">
              #{String(selectedCustomer?.iid).padStart(4, '0')} {selectedCustomer?.firstname}{' '}
              {selectedCustomer?.lastname}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Artikel:</span>
            <span className="font-semibold">{selectedItems.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pfand:</span>
            <span className="font-semibold text-lg">
              {selectedItems
                .reduce((sum, { item, quantity }) => sum + (item.deposit || 0) * quantity, 0)
                .toFixed(2)}{' '}
              €
            </span>
          </div>
        </div>
      </div>

      {/* Create Button */}
      <div className="mt-8 pt-6 border-t">
        <Button
          onClick={handleCreateRental}
          disabled={isCreating || !localEmployee.trim()}
          size="lg"
          className="w-full h-16 text-2xl font-semibold"
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              Erstelle Ausleihe...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-6 w-6" />
              Ausleihe erstellen
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
