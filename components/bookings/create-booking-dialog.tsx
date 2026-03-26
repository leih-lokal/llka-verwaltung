/**
 * Dialog for creating a new booking via a form
 * Alternative to the drag-based creation flow; handles cross-month date ranges
 */

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { UserIcon } from 'lucide-react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { collections } from '@/lib/pocketbase/client';
import { BookingStatus } from '@/types';
import type { Item, Customer } from '@/types';

const createBookingSchema = z
  .object({
    item: z.string().min(1, 'Gegenstand ist erforderlich'),
    customer_name: z.string().min(1, 'Name ist erforderlich'),
    start_date: z.string().min(1, 'Startdatum ist erforderlich'),
    end_date: z.string().min(1, 'Enddatum ist erforderlich'),
    notes: z.string().optional(),
  })
  .refine((data) => data.start_date < data.end_date, {
    message: 'Startdatum muss vor dem Enddatum liegen',
    path: ['end_date'],
  });

interface CreateBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Item[];
  onCreated: () => void;
}

export function CreateBookingDialog({
  open,
  onOpenChange,
  items,
  onCreated,
}: CreateBookingDialogProps) {
  // Form field state
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Customer search state
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [manualName, setManualName] = useState('');

  // Submission state
  const [isCreating, setIsCreating] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset all state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedItemId('');
      setSelectedItem(null);
      setStartDate('');
      setEndDate('');
      setNotes('');
      setQuantity(1);
      setSearch('');
      setResults([]);
      setCustomerId('');
      setCustomerName('');
      setManualName('');
      setErrors({});
    }
  }, [open]);

  // Search customers with 300ms debounce
  useEffect(() => {
    if (!search || search.length < 2) {
      setResults([]);
      return;
    }

    const searchCustomers = async () => {
      setIsSearching(true);
      try {
        const filters = [];
        let sortBy = 'lastname,firstname';

        if (/^\d+$/.test(search)) {
          filters.push(`iid=${parseInt(search, 10)}`);
          sortBy = 'iid';
        } else {
          const trimmed = search.trim();
          if (trimmed.includes(' ')) {
            const parts = trimmed.split(/\s+/);
            const firstName = parts[0];
            const lastName = parts.slice(1).join(' ');
            filters.push(
              `(firstname~'${firstName}' && lastname~'${lastName}')`
            );
            filters.push(
              `(firstname~'${lastName}' && lastname~'${firstName}')`
            );
          }
          filters.push(`firstname~'${trimmed}'`);
          filters.push(`lastname~'${trimmed}'`);
        }

        const filter = filters.join(' || ');
        const result = await collections
          .customers()
          .getList<Customer>(1, 20, { filter, sort: sortBy });
        setResults(result.items);
      } catch (err) {
        console.error('Error searching customers:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleItemChange = (itemId: string) => {
    setSelectedItemId(itemId);
    const item = items.find((i) => i.id === itemId) ?? null;
    setSelectedItem(item);
    setQuantity(1);
    setErrors((prev) => ({ ...prev, item: '' }));
  };

  const handleSelectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setCustomerName(`${customer.firstname} ${customer.lastname}`);
    setManualName('');
    setSearch('');
    setResults([]);
    setErrors((prev) => ({ ...prev, customer_name: '' }));
  };

  const handleManualNameConfirm = () => {
    if (manualName.trim()) {
      setCustomerId('');
      setCustomerName(manualName.trim());
      setErrors((prev) => ({ ...prev, customer_name: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = {
      item: selectedItemId,
      customer_name: customerName,
      start_date: startDate,
      end_date: endDate,
      notes,
    };

    const result = createBookingSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (field) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsCreating(true);
    try {
      const bookingData = {
        item: selectedItemId,
        customer: customerId || '',
        customer_name: customerName,
        customer_phone: '',
        customer_email: '',
        start_date: `${startDate} 00:00:00.000Z`,
        end_date: `${endDate} 00:00:00.000Z`,
        status: BookingStatus.Reserved,
        notes: notes || '',
      };

      const count = selectedItem && selectedItem.copies > 1 ? quantity : 1;

      await Promise.all(
        Array.from({ length: count }, () =>
          collections.bookings().create(bookingData)
        )
      );

      toast.success(count > 1 ? `${count} Buchungen erstellt` : 'Buchung erstellt');
      onCreated();
      onOpenChange(false);
    } catch (err) {
      console.error('Error creating booking:', err);
      const message =
        (err instanceof Error ? err.message : null) ||
        'Fehler beim Erstellen der Buchung';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neue Buchung</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Item Select */}
          <div className="space-y-2">
            <Label htmlFor="item-select">Gegenstand *</Label>
            <Select value={selectedItemId} onValueChange={handleItemChange}>
              <SelectTrigger id="item-select">
                <SelectValue placeholder="Gegenstand auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <span className="font-mono text-primary font-semibold mr-2">
                      #{String(item.iid).padStart(4, '0')}
                    </span>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.item && (
              <p className="text-xs text-destructive">{errors.item}</p>
            )}
          </div>

          {/* Date inputs side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-date">Startdatum *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setErrors((prev) => ({ ...prev, start_date: '' }));
                }}
              />
              {errors.start_date && (
                <p className="text-xs text-destructive">{errors.start_date}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Enddatum *</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setErrors((prev) => ({ ...prev, end_date: '' }));
                }}
              />
              {errors.end_date && (
                <p className="text-xs text-destructive">{errors.end_date}</p>
              )}
            </div>
          </div>

          {/* Customer search */}
          <div className="space-y-2">
            <Label>Nutzer:in *</Label>
            {customerName && (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{customerName}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground text-xs"
                  onClick={() => {
                    setCustomerId('');
                    setCustomerName('');
                  }}
                >
                  ändern
                </button>
              </div>
            )}
            {!customerName && (
              <div className="rounded-md border">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Nutzer:in suchen (Name, Nr)..."
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList>
                    {isSearching ? (
                      <div className="py-4 text-center text-sm">Suche...</div>
                    ) : results.length === 0 && search.length >= 2 ? (
                      <CommandEmpty>Kein/e Nutzer:in gefunden.</CommandEmpty>
                    ) : results.length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        Tippen Sie, um zu suchen...
                      </div>
                    ) : (
                      <CommandGroup heading="Nutzer:innen">
                        {results.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.id}
                            onSelect={() => handleSelectCustomer(customer)}
                            className="group"
                          >
                            <span className="font-mono text-primary font-semibold mr-2 group-aria-selected:text-white">
                              #{String(customer.iid).padStart(4, '0')}
                            </span>
                            <span className="group-aria-selected:text-white">
                              {customer.firstname} {customer.lastname}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    <CommandSeparator />
                    <div className="p-2 space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Oder Name manuell eingeben:
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Name..."
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleManualNameConfirm();
                            }
                          }}
                          className="h-8 text-sm"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleManualNameConfirm}
                          disabled={!manualName.trim()}
                          className="h-8"
                        >
                          <UserIcon className="h-3 w-3 mr-1" />
                          OK
                        </Button>
                      </div>
                    </div>
                  </CommandList>
                </Command>
              </div>
            )}
            {errors.customer_name && (
              <p className="text-xs text-destructive">{errors.customer_name}</p>
            )}
          </div>

          {/* Quantity — only shown for multi-copy items */}
          {selectedItem && selectedItem.copies > 1 && (
            <div className="space-y-2">
              <Label htmlFor="quantity">Anzahl</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={selectedItem.copies}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(
                        1,
                        Math.min(
                          selectedItem.copies,
                          parseInt(e.target.value) || 1
                        )
                      )
                    )
                  }
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">
                  von {selectedItem.copies}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interne Notizen..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Erstelle...' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
