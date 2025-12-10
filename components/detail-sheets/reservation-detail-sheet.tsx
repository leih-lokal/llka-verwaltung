/**
 * Reservation Detail Sheet Component
 * Displays and edits reservation information (edit mode by default)
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { SaveIcon, XIcon, CheckIcon, ChevronsUpDownIcon, PlusIcon, Trash2Icon, ArrowRightIcon, UserPlusIcon } from 'lucide-react';
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
import { collections } from '@/lib/pocketbase/client';
import { formatDate, formatCurrency } from '@/lib/utils/formatting';
import { cn } from '@/lib/utils';
import type { Reservation, ReservationExpanded, Customer, Item } from '@/types';
import { CustomerDetailSheet } from './customer-detail-sheet';

// Validation schema
const reservationSchema = z.object({
  customer_iid: z.number().optional(),
  customer_name: z.string().min(1, 'Nutzername ist erforderlich'),
  customer_phone: z.string().optional(),
  customer_email: z.string().email('Ungültige E-Mail-Adresse').optional().or(z.literal('')),
  is_new_customer: z.boolean(),
  item_ids: z.array(z.string()).min(1, 'Mindestens ein Artikel ist erforderlich'),
  pickup: z.string(),
  comments: z.string().optional(),
  done: z.boolean(),
  on_premises: z.boolean(),
});

type ReservationFormValues = z.infer<typeof reservationSchema>;

interface ReservationDetailSheetProps {
  reservation: ReservationExpanded | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (reservation: Reservation) => void;
  onConvertToRental?: (reservation: ReservationExpanded) => void;
}

export function ReservationDetailSheet({
  reservation,
  open,
  onOpenChange,
  onSave,
  onConvertToRental,
}: ReservationDetailSheetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [showCustomerSheet, setShowCustomerSheet] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<Partial<Customer> | null>(null);

  const isNewReservation = !reservation?.id;

  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      customer_iid: undefined,
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      is_new_customer: false,
      item_ids: [],
      pickup: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:MM
      comments: '',
      done: false,
      on_premises: false,
    },
  });

  const { formState: { isDirty }, watch, setValue } = form;
  const isNewCustomer = watch('is_new_customer');
  const selectedCustomerIid = watch('customer_iid');
  const selectedItemIds = watch('item_ids');

  // Load customers and items for dropdowns
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      // Load customers
      const customersResult = await collections.customers().getList<Customer>(1, 500, {
        sort: 'lastname,firstname',
      });
      setCustomers(customersResult.items);

      // Load items (only show available or reserved items)
      const itemsResult = await collections.items().getList<Item>(1, 500, {
        sort: 'name',
        filter: 'status="instock" || status="reserved"',
      });
      setItems(itemsResult.items);
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Auto-fill customer name when selecting existing customer
  useEffect(() => {
    if (!isNewCustomer && selectedCustomerIid) {
      const customer = customers.find((c) => c.iid === selectedCustomerIid);
      if (customer) {
        form.setValue('customer_name', `${customer.firstname} ${customer.lastname}`);
        form.setValue('customer_phone', customer.phone || '');
        form.setValue('customer_email', customer.email || '');
      }
    }
  }, [selectedCustomerIid, isNewCustomer, customers, form]);

  // Load reservation data when reservation changes
  useEffect(() => {
    if (reservation) {
      form.reset({
        customer_iid: reservation.customer_iid || undefined,
        customer_name: reservation.customer_name,
        customer_phone: reservation.customer_phone || '',
        customer_email: reservation.customer_email || '',
        is_new_customer: reservation.is_new_customer,
        item_ids: reservation.items,
        pickup: reservation.pickup.slice(0, 16), // Convert to datetime-local format
        comments: reservation.comments || '',
        done: reservation.done,
        on_premises: reservation.on_premises,
      });
    } else if (isNewReservation) {
      form.reset({
        customer_iid: undefined,
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        is_new_customer: false,
        item_ids: [],
        pickup: new Date().toISOString().slice(0, 16),
        comments: '',
        done: false,
        on_premises: false,
      });
    }
  }, [reservation, isNewReservation, form]);

  const handleSave = async (data: ReservationFormValues) => {
    setIsLoading(true);
    try {
      // Validate that all selected items are available (instock or reserved)
      const itemsToValidate = items.filter(item => data.item_ids.includes(item.id));
      const unavailableItems = itemsToValidate.filter(item =>
        item.status !== 'instock' && item.status !== 'reserved'
      );

      if (unavailableItems.length > 0) {
        const itemNames = unavailableItems.map(item =>
          `${item.name} (#${String(item.iid).padStart(4, '0')})`
        ).join(', ');
        toast.error(`Folgende Artikel sind nicht verfügbar: ${itemNames}`);
        setIsLoading(false);
        return;
      }

      // Convert datetime-local format (YYYY-MM-DDTHH:MM) to ISO 8601 with seconds
      const pickupDate = new Date(data.pickup);
      const pickupISO = pickupDate.toISOString();

      const formData: Partial<Reservation> = {
        customer_iid: data.is_new_customer ? undefined : data.customer_iid,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone || undefined,
        customer_email: data.customer_email || undefined,
        is_new_customer: data.is_new_customer,
        items: data.item_ids,
        pickup: pickupISO,
        comments: data.comments || undefined,
        done: data.done,
        on_premises: data.on_premises,
      };

      let savedReservation: Reservation;
      if (isNewReservation) {
        savedReservation = await collections.reservations().create<Reservation>(formData);
        toast.success('Reservierung erfolgreich erstellt');
      } else if (reservation) {
        savedReservation = await collections.reservations().update<Reservation>(reservation.id, formData);
        toast.success('Reservierung erfolgreich aktualisiert');
      } else {
        return;
      }

      onSave?.(savedReservation);
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving reservation:', err);
      toast.error('Fehler beim Speichern der Reservierung');
    } finally {
      setIsLoading(false);
    }
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

  const handleDelete = async () => {
    if (!reservation?.id) return;
    setIsLoading(true);
    try {
      await collections.reservations().delete(reservation.id);
      toast.success('Reservierung erfolgreich gelöscht');
      setShowDeleteDialog(false);
      onSave?.(reservation);
      onOpenChange(false);
    } catch (err) {
      console.error('Error deleting reservation:', err);
      toast.error('Fehler beim Löschen der Reservierung');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.iid === selectedCustomerIid);
  const selectedItems = items.filter((i) => selectedItemIds.includes(i.id));

  const handleAddItem = (itemId: string) => {
    if (!selectedItemIds.includes(itemId)) {
      setValue('item_ids', [...selectedItemIds, itemId], { shouldDirty: true });
    }
    setItemSearchOpen(false);
  };

  const handleRemoveItem = (itemId: string) => {
    setValue('item_ids', selectedItemIds.filter((id) => id !== itemId), { shouldDirty: true });
  };

  const handleCreateCustomer = () => {
    const formValues = form.getValues();

    // Parse customer name into firstname and lastname
    const nameParts = formValues.customer_name.trim().split(' ');
    const firstname = nameParts[0] || '';
    const lastname = nameParts.slice(1).join(' ') || '';

    // Prepare customer data from reservation form
    setNewCustomerData({
      firstname,
      lastname,
      email: formValues.customer_email || undefined,
      phone: formValues.customer_phone || undefined,
    });

    setShowCustomerSheet(true);
  };

  const handleCustomerSaved = (savedCustomer: Customer) => {
    // Update the customer list
    setCustomers([...customers, savedCustomer]);

    // Auto-select the new customer and turn off new customer mode
    setValue('customer_iid', savedCustomer.iid, { shouldDirty: true });
    setValue('is_new_customer', false, { shouldDirty: true });

    toast.success(`Nutzer ${savedCustomer.firstname} ${savedCustomer.lastname} wurde erstellt`);
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
                    {isNewReservation ? 'Neue Reservierung' : 'Reservierung'}
                  </SheetTitle>
                </div>
                {!isNewReservation && reservation && (
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <span>Abholung: {formatDate(reservation.pickup)}</span>
                  </div>
                )}
              </div>
              {reservation && (
                <Badge variant={reservation.done ? 'secondary' : 'default'} className="shrink-0">
                  {reservation.done ? 'Erledigt' : 'Offen'}
                </Badge>
              )}
            </div>
          </SheetHeader>

          {/* OTP Display - Prominent Section */}
          {!isNewReservation && reservation?.otp && (
            <div className="mx-6 mb-6 bg-gradient-to-r from-red-200 to-red-50 border-2 border-red-300 rounded-lg p-6 shadow-sm">
              <div className="text-center">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
                  Abholcode
                </p>
                <div className="bg-white rounded-lg px-6 py-4 inline-block shadow-sm">
                  <p className="text-5xl font-bold font-mono tracking-widest text-red-600">
                    {reservation.otp}
                  </p>
                </div>
                <p className="text-xs text-red-600 mt-3">
                  Diesen Code mit der Email des Nutzers vergleichen
                </p>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-8 px-6">
            {/* New Customer Toggle */}
            <div className="pt-4">
              <Button
                type="button"
                variant={isNewCustomer ? "default" : "outline"}
                onClick={() => setValue('is_new_customer', !isNewCustomer, { shouldDirty: true })}
                className="w-full h-auto py-3"
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
                    isNewCustomer ? "bg-primary-foreground border-primary-foreground" : "border-current"
                  )}>
                    {isNewCustomer && <CheckIcon className="h-3 w-3 text-primary" />}
                  </div>
                  <span className="text-base font-medium">
                    Neuer Nutzer (noch nicht registriert)
                  </span>
                </div>
              </Button>
            </div>

            {/* Customer and Items Selection */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Nutzer & Artikel</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Customer Selection */}
                <div className="space-y-4">
              {!isNewCustomer && (
                <div>
                  <Label>Bestehenden Nutzer auswählen</Label>
                  <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerSearchOpen}
                        className="w-full justify-between mt-1"
                        disabled={isLoadingData}
                      >
                        {selectedCustomer
                          ? `#${String(selectedCustomer.iid).padStart(4, '0')} - ${selectedCustomer.firstname} ${selectedCustomer.lastname}`
                          : "Nutzer auswählen..."}
                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Nutzer suchen..." />
                        <CommandList>
                          <CommandEmpty>Kein Nutzer gefunden.</CommandEmpty>
                          <CommandGroup>
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={`${customer.iid} ${customer.firstname} ${customer.lastname} ${customer.email || ''}`}
                                onSelect={() => {
                                  setValue('customer_iid', customer.iid, { shouldDirty: true });
                                  setCustomerSearchOpen(false);
                                }}
                              >
                                <CheckIcon
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCustomerIid === customer.iid ? "opacity-100" : "opacity-0"
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
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Selected Customer Display */}
              {selectedCustomer && !isNewCustomer && (
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

              <div>
                <Label htmlFor="customer_name">Name *</Label>
                <Input
                  id="customer_name"
                  {...form.register('customer_name')}
                  className="mt-1"
                  readOnly={!isNewCustomer && !!selectedCustomerIid}
                />
                {form.formState.errors.customer_name && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.customer_name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer_phone">Telefon</Label>
                  <Input
                    id="customer_phone"
                    {...form.register('customer_phone')}
                    className="mt-1"
                    readOnly={!isNewCustomer && !!selectedCustomerIid}
                  />
                </div>

                <div>
                  <Label htmlFor="customer_email">E-Mail</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    {...form.register('customer_email')}
                    className="mt-1"
                    readOnly={!isNewCustomer && !!selectedCustomerIid}
                  />
                  {form.formState.errors.customer_email && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.customer_email.message}
                    </p>
                  )}
                </div>
              </div>

              {isNewCustomer && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCreateCustomer}
                    className="w-full"
                    disabled={!form.watch('customer_name')}
                  >
                    <UserPlusIcon className="size-4 mr-2" />
                    Als neuen Nutzer anlegen
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Nutzerdaten in die Datenbank übernehmen
                  </p>
                </div>
              )}
                </div>

                {/* Items Selection */}
                <div className="space-y-4">
              <div>
                <Label>Artikel hinzufügen *</Label>
                <Popover open={itemSearchOpen} onOpenChange={setItemSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={itemSearchOpen}
                      className="w-full justify-between mt-1"
                      disabled={isLoadingData}
                    >
                      <span className="flex items-center gap-2">
                        <PlusIcon className="h-4 w-4" />
                        Artikel hinzufügen...
                      </span>
                      <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Artikel suchen..." />
                      <CommandList>
                        <CommandEmpty>Kein Artikel gefunden.</CommandEmpty>
                        <CommandGroup>
                          {items.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={`${item.iid} ${item.name} ${item.brand || ''} ${item.model || ''}`}
                              onSelect={() => handleAddItem(item.id)}
                              disabled={selectedItemIds.includes(item.id)}
                            >
                              <CheckIcon
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedItemIds.includes(item.id) ? "opacity-100" : "opacity-0"
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
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {form.formState.errors.item_ids && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.item_ids.message}
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
                        onClick={() => handleRemoveItem(item.id)}
                        className="shrink-0 h-8 w-8 p-0"
                        title="Entfernen"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
                </div>
              </div>
            </section>

            {/* Reservation Details */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Reservierungsdetails</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="pickup">Abholung (Datum & Zeit) *</Label>
                  <Input
                    id="pickup"
                    type="datetime-local"
                    {...form.register('pickup')}
                    className="mt-1"
                  />
                  {form.formState.errors.pickup && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.pickup.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="comments">Kommentar</Label>
                  <Textarea
                    id="comments"
                    {...form.register('comments')}
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="done"
                    type="checkbox"
                    {...form.register('done')}
                  />
                  <Label htmlFor="done" className="cursor-pointer">
                    Reservierung erledigt
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="on_premises"
                    type="checkbox"
                    {...form.register('on_premises')}
                  />
                  <Label htmlFor="on_premises" className="cursor-pointer">
                    Abholung vor Ort
                  </Label>
                </div>
              </div>
            </section>
          </form>
          </div>

          <SheetFooter className="border-t pt-4 px-6 shrink-0 bg-background">
            <div className="flex justify-between w-full gap-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  <XIcon className="size-4 mr-2" />
                  Abbrechen
                </Button>
                {!isNewReservation && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isLoading}
                  >
                    <Trash2Icon className="size-4 mr-2" />
                    Löschen
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {!isNewReservation && reservation && onConvertToRental && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onConvertToRental(reservation)}
                    disabled={isLoading || isLoadingData}
                  >
                    <ArrowRightIcon className="size-4 mr-2" />
                    In Ausleihe umwandeln
                  </Button>
                )}
                <Button
                  type="submit"
                  onClick={form.handleSubmit(handleSave)}
                  disabled={isLoading || isLoadingData}
                >
                  <SaveIcon className="size-4 mr-2" />
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
            <DialogTitle>Reservierung löschen?</DialogTitle>
            <DialogDescription>
              Möchten Sie diese Reservierung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? 'Wird gelöscht...' : 'Löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Sheet for creating new customer */}
      <CustomerDetailSheet
        customer={newCustomerData as Customer | null}
        open={showCustomerSheet}
        onOpenChange={setShowCustomerSheet}
        onSave={handleCustomerSaved}
      />
    </>
  );
}
