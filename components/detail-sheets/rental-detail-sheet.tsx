/**
 * Rental Detail Sheet Component
 * Displays and edits rental information
 * Based on the old Svelte version's patterns
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { SaveIcon, XIcon, CheckIcon, ChevronsUpDownIcon, CalendarIcon, TrashIcon } from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { collections } from '@/lib/pocketbase/client';
import { formatDate, formatCurrency, calculateRentalStatus } from '@/lib/utils/formatting';
import { cn } from '@/lib/utils';
import type { Rental, RentalExpanded, Customer, Item } from '@/types';

// Validation schema
const rentalSchema = z.object({
  customer_iid: z.number().min(1, 'Kunde ist erforderlich'),
  item_iids: z.array(z.number()).min(1, 'Mindestens ein Artikel ist erforderlich'),
  deposit: z.number().min(0, 'Kaution muss positiv sein'),
  deposit_back: z.number().min(0, 'Rückkaution muss positiv sein'),
  rented_on: z.string(),
  returned_on: z.string().optional(),
  expected_on: z.string(),
  extended_on: z.string().optional(),
  remark: z.string().optional(),
  employee: z.string().min(1, 'Mitarbeiter (Ausgabe) ist erforderlich'),
  employee_back: z.string().optional(),
});

type RentalFormValues = z.infer<typeof rentalSchema>;

// Date helper functions
function formatDateDisplay(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function isValidDate(date: Date | undefined): boolean {
  if (!date) return false;
  return !isNaN(date.getTime());
}

function dateToString(date: Date | undefined): string {
  if (!date || !isValidDate(date)) return '';
  return date.toISOString().split('T')[0];
}

function stringToDate(dateString: string | undefined): Date | undefined {
  if (!dateString) return undefined;
  const date = new Date(dateString + 'T00:00:00');
  return isValidDate(date) ? date : undefined;
}

interface RentalDetailSheetProps {
  rental: RentalExpanded | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (rental: Rental) => void;
  preloadedItems?: Item[];
}

export function RentalDetailSheet({
  rental,
  open,
  onOpenChange,
  onSave,
  preloadedItems = [],
}: RentalDetailSheetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Customer state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

  // Item state
  const [itemSearch, setItemSearch] = useState('');
  const [itemResults, setItemResults] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [isSearchingItems, setIsSearchingItems] = useState(false);

  // Date picker state
  const [rentedOnPickerOpen, setRentedOnPickerOpen] = useState(false);
  const [expectedOnPickerOpen, setExpectedOnPickerOpen] = useState(false);
  const [extendedOnPickerOpen, setExtendedOnPickerOpen] = useState(false);
  const [returnedOnPickerOpen, setReturnedOnPickerOpen] = useState(false);

  const isNewRental = !rental?.id;

  const form = useForm<RentalFormValues>({
    resolver: zodResolver(rentalSchema),
    defaultValues: {
      customer_iid: 0,
      item_iids: [],
      deposit: 0,
      deposit_back: 0,
      rented_on: new Date().toISOString().split('T')[0],
      returned_on: '',
      expected_on: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      extended_on: '',
      remark: '',
      employee: '',
      employee_back: '',
    },
  });

  const { formState: { isDirty }, watch, setValue, getValues } = form;
  const watchedValues = watch(['rented_on', 'expected_on', 'extended_on', 'returned_on']);
  const [rentedOn, expectedOn, extendedOn, returnedOn] = watchedValues;

  // Load rental data when rental changes
  useEffect(() => {
    if (rental && open) {

      // Set customer if expanded
      if (rental.expand?.customer) {
        setSelectedCustomer(rental.expand.customer);
        setValue('customer_iid', rental.expand.customer.iid);
      }

      // Set items if expanded (support multiple items)
      if (rental.expand?.items && rental.expand.items.length > 0) {
        setSelectedItems(rental.expand.items);
        setValue('item_iids', rental.expand.items.map(item => item.iid));
      }

      // Set form values - handle both 'T' and space separators in date strings
      const parseDate = (dateStr: string | undefined) => {
        if (!dateStr) return '';
        // Handle both ISO format (2022-11-10T00:00:00) and space format (2022-11-10 00:00:00)
        return dateStr.split(/[T\s]/)[0];
      };

      const rentedOnValue = parseDate(rental.rented_on) || new Date().toISOString().split('T')[0];
      const returnedOnValue = parseDate(rental.returned_on);
      const expectedOnValue = parseDate(rental.expected_on) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const extendedOnValue = parseDate(rental.extended_on);

      form.reset({
        customer_iid: rental.expand?.customer?.iid ?? 0,
        item_iids: rental.expand?.items?.map(item => item.iid) ?? [],
        deposit: rental.deposit ?? 0,
        deposit_back: rental.deposit_back ?? 0,
        rented_on: rentedOnValue,
        returned_on: returnedOnValue,
        expected_on: expectedOnValue,
        extended_on: extendedOnValue,
        remark: rental.remark || '',
        employee: rental.employee || '',
        employee_back: rental.employee_back || '',
      });
    } else if (isNewRental && open) {
      // Reset for new rental
      setSelectedCustomer(null);

      // Use preloaded items if provided
      const itemsToUse = preloadedItems.length > 0 ? preloadedItems : [];
      setSelectedItems(itemsToUse);

      // Calculate total deposit from preloaded items
      const totalDeposit = itemsToUse.reduce((sum, item) => sum + (item.deposit || 0), 0);

      const defaultRentedOn = new Date().toISOString().split('T')[0];
      const defaultExpectedOn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      form.reset({
        customer_iid: 0,
        item_iids: itemsToUse.map(item => item.iid),
        deposit: totalDeposit,
        deposit_back: 0,
        rented_on: defaultRentedOn,
        returned_on: '',
        expected_on: defaultExpectedOn,
        extended_on: '',
        remark: '',
        employee: '',
        employee_back: '',
      });
    }
  }, [rental, isNewRental, form, open, setValue, preloadedItems]);

  // Search customers
  useEffect(() => {
    if (!customerSearch || customerSearch.length < 2) {
      setCustomerResults([]);
      return;
    }

    const searchCustomers = async () => {
      setIsSearchingCustomers(true);
      try {
        const filters = [];

        // If search is numeric, search by iid
        if (/^\d+$/.test(customerSearch)) {
          filters.push(`iid~'${customerSearch}'`);
        }

        // Always search by name
        filters.push(`firstname~'${customerSearch}'`);
        filters.push(`lastname~'${customerSearch}'`);
        filters.push(`email~'${customerSearch}'`);

        const filter = filters.join(' || ');

        const result = await collections.customers().getList<Customer>(1, 20, {
          filter,
          sort: 'lastname,firstname',
        });

        setCustomerResults(result.items);
      } catch (err) {
        console.error('Error searching customers:', err);
      } finally {
        setIsSearchingCustomers(false);
      }
    };

    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Search items
  useEffect(() => {
    if (!itemSearch || itemSearch.length < 2) {
      setItemResults([]);
      return;
    }

    const searchItems = async () => {
      setIsSearchingItems(true);
      try {
        const filters = [];

        // If search is numeric, search by iid
        if (/^\d+$/.test(itemSearch)) {
          filters.push(`iid~'${itemSearch}'`);
        }

        // Always search by name
        filters.push(`name~'${itemSearch}'`);
        filters.push(`brand~'${itemSearch}'`);
        filters.push(`model~'${itemSearch}'`);

        // Don't show deleted items
        const filter = `(${filters.join(' || ')}) && status!='deleted'`;

        const result = await collections.items().getList<Item>(1, 20, {
          filter,
          sort: 'name',
        });

        setItemResults(result.items);
      } catch (err) {
        console.error('Error searching items:', err);
      } finally {
        setIsSearchingItems(false);
      }
    };

    const timer = setTimeout(searchItems, 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  // Show notifications for selected customer
  const showCustomerNotifications = async (customer: Customer) => {
    try {
      // Check for active rentals
      const activeRentalsFilter = `customer='${customer.id}' && returned_on=''`;
      const activeRentals = await collections.rentals().getList<RentalExpanded>(1, 10, {
        filter: activeRentalsFilter,
        expand: 'items',
      });

      if (activeRentals.items.length > 0) {
        const itemNames = activeRentals.items
          .flatMap(r => r.expand?.items?.map(i => i.name) || [])
          .filter(Boolean);

        if (itemNames.length > 0 && itemNames.length < 3) {
          toast.warning(`Nutzer:in hat schon diese Gegenstände ausgeliehen: ${itemNames.join(', ')}`, {
            duration: 6000,
          });
        } else if (itemNames.length >= 3) {
          toast.error(`Nutzer:in hat schon mehr als 2 Gegenstände ausgeliehen: ${itemNames.join(', ')}`, {
            duration: 6000,
          });
        }
      }

      // Check for customer remark
      if (customer.remark && customer.remark.trim() !== '') {
        toast.error(customer.remark, { duration: Infinity });
      }

      // Check for highlight color
      if (customer.highlight_color) {
        const colorDescriptions: Record<string, string> = {
          green: 'Grün - Positiv markiert',
          blue: 'Blau - Information',
          yellow: 'Gelb - Warnung',
          red: 'Rot - Wichtig/Problem',
        };
        const description = colorDescriptions[customer.highlight_color] || customer.highlight_color;
        toast.info(`Diese/r Nutzer:in wurde farblich markiert: ${description}`, {
          duration: Infinity,
        });
      }
    } catch (err) {
      console.error('Error checking customer:', err);
    }
  };

  // Show notifications for selected item
  const showItemNotifications = (item: Item) => {
    // Check item status
    const statusMapping: Record<string, string> = {
      instock: 'verfügbar',
      outofstock: 'verliehen',
      reserved: 'reserviert',
      lost: 'verschollen',
      repairing: 'in Reparatur',
      forsale: 'zu verkaufen',
    };

    const status = statusMapping[item.status] || item.status;

    if (['outofstock', 'reserved', 'lost', 'repairing', 'forsale'].includes(item.status)) {
      toast.error(`${item.name} (#${String(item.iid).padStart(4, '0')}) ist nicht verfügbar, hat Status: ${status}`, {
        duration: 10000,
      });
    }

    // Check for highlight color
    if (item.highlight_color) {
      const colorDescriptions: Record<string, string> = {
        green: 'Grün - Positiv markiert',
        blue: 'Blau - Information',
        yellow: 'Gelb - Warnung',
        red: 'Rot - Wichtig/Problem',
      };
      const description = colorDescriptions[item.highlight_color] || item.highlight_color;
      toast.info(`${item.name} (#${String(item.iid).padStart(4, '0')}) wurde farblich markiert: ${description}`, {
        duration: Infinity,
      });
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setValue('customer_iid', customer.iid, { shouldDirty: true });
    setCustomerSearchOpen(false);
    setCustomerSearch('');
    showCustomerNotifications(customer);
  };

  const handleItemSelect = (item: Item) => {
    // Check if item is already selected
    if (selectedItems.some(i => i.id === item.id)) {
      toast.warning('Dieser Gegenstand wurde bereits hinzugefügt');
      return;
    }

    const newSelectedItems = [...selectedItems, item];
    setSelectedItems(newSelectedItems);
    setValue('item_iids', newSelectedItems.map(i => i.iid), { shouldDirty: true });

    // Auto-calculate total deposit from all items
    const totalDeposit = newSelectedItems.reduce((sum, i) => sum + (i.deposit || 0), 0);
    setValue('deposit', totalDeposit, { shouldDirty: true });

    setItemSearchOpen(false);
    setItemSearch('');
    showItemNotifications(item);
  };

  const handleItemRemove = (itemId: string) => {
    const newSelectedItems = selectedItems.filter(i => i.id !== itemId);
    setSelectedItems(newSelectedItems);
    setValue('item_iids', newSelectedItems.map(i => i.iid), { shouldDirty: true });

    // Recalculate deposit
    const totalDeposit = newSelectedItems.reduce((sum, i) => sum + (i.deposit || 0), 0);
    setValue('deposit', totalDeposit, { shouldDirty: true });
  };

  const handleSave = async (data: RentalFormValues) => {
    setIsLoading(true);
    try {
      // Get customer by iid to get its PocketBase ID
      const customer = await collections.customers().getFirstListItem<Customer>(`iid=${data.customer_iid}`);

      // Get all items by iid to get their PocketBase IDs
      const itemIds = await Promise.all(
        data.item_iids.map(async (iid) => {
          const item = await collections.items().getFirstListItem<Item>(`iid=${iid}`);
          return item.id;
        })
      );

      const formData: Partial<Rental> = {
        customer: customer.id,
        items: itemIds, // Multiple items per rental
        deposit: data.deposit,
        deposit_back: data.deposit_back,
        rented_on: data.rented_on,
        returned_on: data.returned_on || undefined,
        expected_on: data.expected_on,
        extended_on: data.extended_on || undefined,
        remark: data.remark || undefined,
        employee: data.employee,
        employee_back: data.employee_back || undefined,
      };

      let savedRental: Rental;
      if (isNewRental) {
        savedRental = await collections.rentals().create<Rental>(formData);
        toast.success('Leihvorgang erfolgreich erstellt');
      } else if (rental) {
        savedRental = await collections.rentals().update<Rental>(rental.id, formData);
        toast.success('Leihvorgang erfolgreich aktualisiert');
      } else {
        return;
      }

      onSave?.(savedRental);
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving rental:', err);
      toast.error('Fehler beim Speichern des Leihvorgangs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!rental?.id) return;

    setIsLoading(true);
    try {
      await collections.rentals().delete(rental.id);
      toast.success('Leihvorgang erfolgreich gelöscht');
      setShowDeleteDialog(false);
      onSave?.(rental as Rental);
      onOpenChange(false);
    } catch (err) {
      console.error('Error deleting rental:', err);
      toast.error('Fehler beim Löschen des Leihvorgangs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturn = async () => {
    if (isNewRental) return;

    const data = form.getValues();

    // Set return date to today if not set
    if (!data.returned_on) {
      setValue('returned_on', new Date().toISOString().split('T')[0], { shouldDirty: true });
    }

    // Set deposit_back to deposit if not set
    if (data.deposit_back === 0 && data.deposit > 0) {
      setValue('deposit_back', data.deposit, { shouldDirty: true });
    }

    // Submit the form
    form.handleSubmit(handleSave)();
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelDialog(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelDialog(false);
    form.reset();
    onOpenChange(false);
  };

  const rentalStatus = rental
    ? calculateRentalStatus(
        rental.rented_on,
        rental.returned_on,
        rental.expected_on,
        rental.extended_on
      )
    : null;

  const getStatusBadge = (status: string) => {
    const statusMap = {
      active: { label: 'Aktiv', variant: 'default' as const },
      returned: { label: 'Zurückgegeben', variant: 'secondary' as const },
      overdue: { label: 'Überfällig', variant: 'destructive' as const },
      due_today: { label: 'Heute fällig', variant: 'secondary' as const },
      returned_today: { label: 'Heute zurückgegeben', variant: 'secondary' as const },
    };
    const { label, variant } = statusMap[status as keyof typeof statusMap] || statusMap.active;
    return <Badge variant={variant}>{label}</Badge>;
  };

  // Date quick-action helpers
  const setRentedOnToday = () => {
    setValue('rented_on', new Date().toISOString().split('T')[0], { shouldDirty: true });
  };

  const setExpectedOn = (weeks: number) => {
    const date = new Date();
    date.setDate(date.getDate() + weeks * 7);
    setValue('expected_on', date.toISOString().split('T')[0], { shouldDirty: true });
  };

  const setReturnedOnToday = () => {
    setValue('returned_on', new Date().toISOString().split('T')[0], { shouldDirty: true });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(open) => {
        if (!open && isDirty) {
          setShowCancelDialog(true);
        } else {
          onOpenChange(open);
        }
      }}>
        <SheetContent className="w-full sm:max-w-4xl flex flex-col overflow-hidden">
          <SheetHeader className="border-b pb-6 mb-6 px-6 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="mb-2">
                  <SheetTitle className="text-2xl">
                    {isNewRental ? 'Neuer Leihvorgang' : 'Leihvorgang bearbeiten'}
                  </SheetTitle>
                </div>
                {!isNewRental && rental && (
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <span>Ausgeliehen: {formatDate(rental.rented_on)}</span>
                    <span>•</span>
                    <span>Erwartet: {formatDate(rental.expected_on)}</span>
                  </div>
                )}
              </div>
              {rentalStatus && (
                <div className="shrink-0">{getStatusBadge(rentalStatus)}</div>
              )}
            </div>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-8 px-6 overflow-y-auto flex-1">
            {/* Customer and Item Selection */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Nutzer:in & Gegenstände</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Customer Selection */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="customer">Nutzer:in auswählen *</Label>
                    <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={customerSearchOpen}
                          className="w-full justify-between mt-1"
                        >
                          {selectedCustomer
                            ? `#${String(selectedCustomer.iid).padStart(4, '0')} - ${selectedCustomer.firstname} ${selectedCustomer.lastname}`
                            : "Nutzer:in auswählen..."}
                          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Nutzer:in suchen (Name, Nr, E-Mail)..."
                            value={customerSearch}
                            onValueChange={setCustomerSearch}
                          />
                          <CommandList>
                            {isSearchingCustomers ? (
                              <div className="py-6 text-center text-sm">Suche...</div>
                            ) : customerResults.length === 0 && customerSearch.length >= 2 ? (
                              <CommandEmpty>Kein/e Nutzer:in gefunden.</CommandEmpty>
                            ) : customerResults.length === 0 ? (
                              <div className="py-6 text-center text-sm text-muted-foreground">
                                Tippen Sie, um zu suchen...
                              </div>
                            ) : (
                              <CommandGroup>
                                {customerResults.map((customer) => (
                                  <CommandItem
                                    key={customer.id}
                                    value={customer.id}
                                    onSelect={() => handleCustomerSelect(customer)}
                                  >
                                    <CheckIcon
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span className="font-mono text-primary font-semibold mr-2">
                                      #{String(customer.iid).padStart(4, '0')}
                                    </span>
                                    <span>{customer.firstname} {customer.lastname}</span>
                                    {customer.email && (
                                      <span className="ml-2 text-muted-foreground text-xs">
                                        {customer.email}
                                      </span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {form.formState.errors.customer_iid && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.customer_iid.message}
                      </p>
                    )}
                  </div>

                  {/* Selected Customer Display */}
                  {selectedCustomer && (
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-mono text-primary font-semibold text-lg">
                              #{String(selectedCustomer.iid).padStart(4, '0')}
                            </span>
                            <span className="font-semibold text-lg">
                              {selectedCustomer.firstname} {selectedCustomer.lastname}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {selectedCustomer.email && <p>{selectedCustomer.email}</p>}
                            {selectedCustomer.phone && <p>{selectedCustomer.phone}</p>}
                            {selectedCustomer.street && (
                              <p>{selectedCustomer.street}, {selectedCustomer.postal_code} {selectedCustomer.city}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Item Selection */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="item">Gegenstände auswählen *</Label>
                    <Popover open={itemSearchOpen} onOpenChange={setItemSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={itemSearchOpen}
                          className="w-full justify-between mt-1"
                        >
                          {selectedItems.length > 0
                            ? `${selectedItems.length} Gegenstand${selectedItems.length > 1 ? 'e' : ''} ausgewählt`
                            : "Gegenstand hinzufügen..."}
                          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Gegenstand suchen (Name, Nr, Marke)..."
                            value={itemSearch}
                            onValueChange={setItemSearch}
                          />
                          <CommandList>
                            {isSearchingItems ? (
                              <div className="py-6 text-center text-sm">Suche...</div>
                            ) : itemResults.length === 0 && itemSearch.length >= 2 ? (
                              <CommandEmpty>Kein Gegenstand gefunden.</CommandEmpty>
                            ) : itemResults.length === 0 ? (
                              <div className="py-6 text-center text-sm text-muted-foreground">
                                Tippen Sie, um zu suchen...
                              </div>
                            ) : (
                              <CommandGroup>
                                {itemResults.map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={item.id}
                                    onSelect={() => handleItemSelect(item)}
                                  >
                                    <CheckIcon
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedItems.some(i => i.id === item.id) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span className="font-mono text-primary font-semibold mr-2">
                                      #{String(item.iid).padStart(4, '0')}
                                    </span>
                                    <span className="flex-1">{item.name}</span>
                                    <span className="text-muted-foreground text-xs ml-2">
                                      {formatCurrency(item.deposit)}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {form.formState.errors.item_iids && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.item_iids.message}
                      </p>
                    )}
                  </div>

                  {/* Selected Items Display */}
                  {selectedItems.length > 0 && (
                    <div className="space-y-2">
                      {selectedItems.map((item) => (
                        <div key={item.id} className="border rounded-lg p-3 bg-muted/50 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="font-mono text-primary font-semibold">
                                #{String(item.iid).padStart(4, '0')}
                              </span>
                              <span className="font-semibold truncate">{item.name}</span>
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              {item.brand && <span>Marke: {item.brand}</span>}
                              {item.model && <span>Modell: {item.model}</span>}
                              <span className="font-medium text-foreground">
                                {formatCurrency(item.deposit)}
                              </span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleItemRemove(item.id)}
                            className="shrink-0 h-8 w-8 p-0"
                            title="Entfernen"
                          >
                            <XIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="text-sm font-medium pt-2 border-t">
                        Gesamt Kaution: {formatCurrency(selectedItems.reduce((sum, i) => sum + (i.deposit || 0), 0))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Dates */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Zeitraum</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Rented On */}
                <div>
                  <Label htmlFor="rented_on">Ausgeliehen am *</Label>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <Input
                        id="rented_on"
                        value={rentedOn && stringToDate(rentedOn) ? formatDateDisplay(stringToDate(rentedOn)) : ''}
                        placeholder="Tag auswählen..."
                        className="bg-background pr-10 cursor-pointer"
                        readOnly
                        onClick={() => setRentedOnPickerOpen(true)}
                      />
                      <Popover open={rentedOnPickerOpen} onOpenChange={setRentedOnPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                          >
                            <CalendarIcon className="size-3.5" />
                            <span className="sr-only">Datum auswählen</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto overflow-hidden p-0"
                          align="end"
                          alignOffset={-8}
                          sideOffset={10}
                        >
                          <Calendar
                            mode="single"
                            selected={stringToDate(rentedOn)}
                            captionLayout="dropdown"
                            onSelect={(date) => {
                              setValue('rented_on', dateToString(date), { shouldDirty: true });
                              setRentedOnPickerOpen(false);
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={setRentedOnToday}
                      className="shrink-0"
                      title="Heute"
                    >
                      Heute
                    </Button>
                  </div>
                  {form.formState.errors.rented_on && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.rented_on.message}
                    </p>
                  )}
                </div>

                {/* Expected On */}
                <div>
                  <Label htmlFor="expected_on">Zurückerwartet am *</Label>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <Input
                        id="expected_on"
                        value={expectedOn && stringToDate(expectedOn) ? formatDateDisplay(stringToDate(expectedOn)) : ''}
                        placeholder="Tag auswählen..."
                        className="bg-background pr-10 cursor-pointer"
                        readOnly
                        onClick={() => setExpectedOnPickerOpen(true)}
                      />
                      <Popover open={expectedOnPickerOpen} onOpenChange={setExpectedOnPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                          >
                            <CalendarIcon className="size-3.5" />
                            <span className="sr-only">Datum auswählen</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto overflow-hidden p-0"
                          align="end"
                          alignOffset={-8}
                          sideOffset={10}
                        >
                          <Calendar
                            mode="single"
                            selected={stringToDate(expectedOn)}
                            captionLayout="dropdown"
                            onSelect={(date) => {
                              setValue('expected_on', dateToString(date), { shouldDirty: true });
                              setExpectedOnPickerOpen(false);
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setExpectedOn(1)}
                        title="1 Woche"
                      >
                        1W
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setExpectedOn(2)}
                        title="2 Wochen"
                      >
                        2W
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setExpectedOn(3)}
                        title="3 Wochen"
                      >
                        3W
                      </Button>
                    </div>
                  </div>
                  {form.formState.errors.expected_on && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.expected_on.message}
                    </p>
                  )}
                </div>

                {/* Extended On */}
                {!isNewRental && (
                  <div>
                    <Label htmlFor="extended_on">Verlängert bis</Label>
                    <div className="flex gap-2 mt-1">
                      <div className="relative flex-1">
                        <Input
                          id="extended_on"
                          value={extendedOn && stringToDate(extendedOn) ? formatDateDisplay(stringToDate(extendedOn)) : ''}
                          placeholder="Tag auswählen..."
                          className="bg-background pr-10 cursor-pointer"
                          readOnly
                          onClick={() => setExtendedOnPickerOpen(true)}
                        />
                        <Popover open={extendedOnPickerOpen} onOpenChange={setExtendedOnPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                            >
                              <CalendarIcon className="size-3.5" />
                              <span className="sr-only">Datum auswählen</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto overflow-hidden p-0"
                            align="end"
                            alignOffset={-8}
                            sideOffset={10}
                          >
                            <Calendar
                              mode="single"
                              selected={stringToDate(extendedOn)}
                              captionLayout="dropdown"
                              onSelect={(date) => {
                                setValue('extended_on', dateToString(date), { shouldDirty: true });
                                setExtendedOnPickerOpen(false);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setValue('extended_on', new Date().toISOString().split('T')[0], { shouldDirty: true })}
                        className="shrink-0"
                        title="Heute"
                      >
                        Heute
                      </Button>
                    </div>
                  </div>
                )}

                {/* Returned On */}
                {!isNewRental && (
                  <div>
                    <Label htmlFor="returned_on">Zurückgegeben am</Label>
                    <div className="flex gap-2 mt-1">
                      <div className="relative flex-1">
                        <Input
                          id="returned_on"
                          value={returnedOn && stringToDate(returnedOn) ? formatDateDisplay(stringToDate(returnedOn)) : ''}
                          placeholder="Tag auswählen..."
                          className="bg-background pr-10 cursor-pointer"
                          readOnly
                          onClick={() => setReturnedOnPickerOpen(true)}
                        />
                        <Popover open={returnedOnPickerOpen} onOpenChange={setReturnedOnPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                            >
                              <CalendarIcon className="size-3.5" />
                              <span className="sr-only">Datum auswählen</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto overflow-hidden p-0"
                            align="end"
                            alignOffset={-8}
                            sideOffset={10}
                          >
                            <Calendar
                              mode="single"
                              selected={stringToDate(returnedOn)}
                              captionLayout="dropdown"
                              onSelect={(date) => {
                                setValue('returned_on', dateToString(date), { shouldDirty: true });
                                setReturnedOnPickerOpen(false);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={setReturnedOnToday}
                        className="shrink-0"
                        title="Heute zurückgegeben"
                      >
                        Heute
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Financial */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Pfand</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="deposit">Pfand gegeben (€) *</Label>
                  <Input
                    id="deposit"
                    type="number"
                    step="0.01"
                    {...form.register('deposit', { valueAsNumber: true })}
                    className="mt-1"
                  />
                  {form.formState.errors.deposit && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.deposit.message}
                    </p>
                  )}
                </div>

                {!isNewRental && (
                  <div>
                    <Label htmlFor="deposit_back">Pfand zurückgegeben (€) *</Label>
                    <Input
                      id="deposit_back"
                      type="number"
                      step="0.01"
                      {...form.register('deposit_back', { valueAsNumber: true })}
                      className="mt-1"
                    />
                    {form.formState.errors.deposit_back && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.deposit_back.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Additional Information */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Mitarbeiter</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee">Ausgabe *</Label>
                  <Input
                    id="employee"
                    {...form.register('employee')}
                    className="mt-1"
                  />
                  {form.formState.errors.employee && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.employee.message}
                    </p>
                  )}
                </div>

                {!isNewRental && (
                  <div>
                    <Label htmlFor="employee_back">Rücknahme</Label>
                    <Input
                      id="employee_back"
                      {...form.register('employee_back')}
                      className="mt-1"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <Label htmlFor="remark">Bemerkung</Label>
                  <Textarea
                    id="remark"
                    {...form.register('remark')}
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
            </section>
          </form>

          <SheetFooter className="border-t pt-6 pb-6 px-6 shrink-0 bg-background">
            <div className="flex justify-between w-full gap-4">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                  size="lg"
                  className="min-w-[120px]"
                >
                  <XIcon className="size-5 mr-2" />
                  Abbrechen
                </Button>
                {!isNewRental && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isLoading}
                    size="lg"
                    className="min-w-[120px]"
                  >
                    <TrashIcon className="size-5 mr-2" />
                    Löschen
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                {!isNewRental && !returnedOn && (
                  <Button
                    type="button"
                    variant="default"
                    className="bg-green-600 hover:bg-green-700 min-w-[140px]"
                    onClick={handleReturn}
                    disabled={isLoading}
                    size="lg"
                  >
                    <CheckIcon className="size-5 mr-2" />
                    Zurückgeben
                  </Button>
                )}
                <Button
                  type="submit"
                  onClick={form.handleSubmit(handleSave)}
                  disabled={isLoading}
                  size="lg"
                  className="min-w-[120px]"
                >
                  <SaveIcon className="size-5 mr-2" />
                  {isLoading ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Änderungen verwerfen?</DialogTitle>
            <DialogDescription>
              Sie haben ungespeicherte Änderungen. Möchten Sie diese wirklich verwerfen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Zurück
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>
              Verwerfen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leihvorgang löschen?</DialogTitle>
            <DialogDescription>
              Möchten Sie diesen Leihvorgang wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
