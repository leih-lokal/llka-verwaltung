/**
 * Customer Detail Sheet Component
 * Displays and edits customer information with rental/reservation history
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PencilIcon, SaveIcon, XIcon, MailIcon, PhoneIcon, MapPinIcon, CalendarIcon, Trash2Icon, UserIcon, PaletteIcon, Heart, PrinterIcon } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
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
import { formatDate, formatCurrency, calculateRentalStatus, dateToLocalString, localStringToDate } from '@/lib/utils/formatting';
import { getRentalStatusLabel } from '@/lib/constants/statuses';
import { generateCustomerPrintContent } from '@/components/print/customer-print-content';
import type { Customer, CustomerFormData, Rental, RentalExpanded, Reservation, ReservationExpanded, HighlightColor } from '@/types';

// Validation schema
const customerSchema = z.object({
  iid: z.number().int().min(1, 'ID muss mindestens 1 sein'),
  firstname: z.string().min(1, 'Vorname ist erforderlich'),
  lastname: z.string().min(1, 'Nachname ist erforderlich'),
  email: z.string().email('Ungültige E-Mail-Adresse').optional().or(z.literal('')),
  phone: z.string().optional(),
  street: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  registered_on: z.string(),
  renewed_on: z.string().optional(),
  newsletter: z.boolean(),
  remark: z.string().optional(),
  highlight_color: z.enum(['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', '']).optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerDetailSheetProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (customer: Customer) => void;
}

export function CustomerDetailSheet({
  customer,
  open,
  onOpenChange,
  onSave,
}: CustomerDetailSheetProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [rentals, setRentals] = useState<RentalExpanded[]>([]);
  const [reservations, setReservations] = useState<ReservationExpanded[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showAllRentals, setShowAllRentals] = useState(false);
  const [showAllReservations, setShowAllReservations] = useState(false);

  const isNewCustomer = !customer?.id;

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      iid: 1,
      firstname: '',
      lastname: '',
      email: '',
      phone: '',
      street: '',
      postal_code: '',
      city: '',
      registered_on: dateToLocalString(new Date()),
      renewed_on: '',
      newsletter: false,
      remark: '',
      highlight_color: '',
    },
  });

  const { formState: { isDirty } } = form;

  // Load customer data when customer changes
  useEffect(() => {
    if (customer && customer.id) {
      // Existing customer - load all data
      const formData = {
        iid: customer.iid,
        firstname: customer.firstname,
        lastname: customer.lastname,
        email: customer.email || '',
        phone: customer.phone || '',
        street: customer.street || '',
        postal_code: customer.postal_code || '',
        city: customer.city || '',
        // Extract just the date part (YYYY-MM-DD) from PocketBase format (YYYY-MM-DD HH:MM:SS.000Z)
        registered_on: customer.registered_on.split(' ')[0],
        renewed_on: customer.renewed_on ? customer.renewed_on.split(' ')[0] : '',
        newsletter: customer.newsletter,
        remark: customer.remark || '',
        highlight_color: (customer.highlight_color || '') as '' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink',
      };
      form.reset(formData);
      setIsEditMode(false);
    } else if (customer && !customer.id) {
      // Partial customer data (e.g., from reservation) - pre-fill what we have
      const fetchNextIid = async () => {
        try {
          const result = await collections.customers().getList<Customer>(1, 1, {
            sort: '-iid',
          });
          const nextIid = result.items.length > 0 ? result.items[0].iid + 1 : 1;

          form.reset({
            iid: nextIid,
            firstname: customer.firstname || '',
            lastname: customer.lastname || '',
            email: customer.email || '',
            phone: customer.phone || '',
            street: customer.street || '',
            postal_code: customer.postal_code || '',
            city: customer.city || '',
            registered_on: dateToLocalString(new Date()),
            renewed_on: '',
            newsletter: false,
            remark: '',
            highlight_color: '',
          });
          setIsEditMode(true);
        } catch (err) {
          console.error('Error fetching next IID:', err);
        }
      };
      fetchNextIid();
    } else if (isNewCustomer) {
      // Fetch next available IID for new customers
      const fetchNextIid = async () => {
        try {
          const lastCustomer = await collections.customers().getFirstListItem<Customer>('', { sort: '-iid' });
          const nextIid = (lastCustomer?.iid || 0) + 1;
          form.reset({
            iid: nextIid,
            firstname: '',
            lastname: '',
            email: '',
            phone: '',
            street: '',
            postal_code: '',
            city: '',
            registered_on: dateToLocalString(new Date()),
            renewed_on: '',
            newsletter: false,
            remark: '',
            highlight_color: '',
          });
        } catch (err) {
          // If no customers exist yet, start with 1
          form.reset({
            iid: 1,
            firstname: '',
            lastname: '',
            email: '',
            phone: '',
            street: '',
            postal_code: '',
            city: '',
            registered_on: dateToLocalString(new Date()),
            renewed_on: '',
            newsletter: false,
            remark: '',
            highlight_color: '',
          });
        }
      };
      fetchNextIid();
      setIsEditMode(true);
    }
  }, [customer, isNewCustomer, form]);

  // Load rental and reservation history
  useEffect(() => {
    if (customer?.id && open) {
      loadHistory();
    }
  }, [customer?.id, open]);

  const loadHistory = async () => {
    if (!customer?.id) return;

    setIsLoadingHistory(true);
    try {
      // Load rentals
      const rentalsResult = await collections.rentals().getList<RentalExpanded>(1, 50, {
        filter: `customer="${customer.id}"`,
        sort: '-rented_on',
        expand: 'customer,items',
      });
      setRentals(rentalsResult.items);

      // Load reservations
      const reservationsResult = await collections.reservations().getList<ReservationExpanded>(1, 50, {
        filter: `customer_iid=${customer.iid}`,
        sort: '-pickup',
        expand: 'items',
      });
      setReservations(reservationsResult.items);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSave = async (data: CustomerFormValues) => {
    setIsLoading(true);
    try {
      const formData: Partial<Customer> = {
        iid: data.iid,
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email || undefined,
        phone: data.phone || undefined,
        street: data.street || undefined,
        postal_code: data.postal_code || undefined,
        city: data.city || undefined,
        registered_on: data.registered_on,
        renewed_on: data.renewed_on || undefined,
        newsletter: data.newsletter,
        remark: data.remark || undefined,
        highlight_color: data.highlight_color ? (data.highlight_color as HighlightColor) : ('' as any),
      };

      let savedCustomer: Customer;
      if (isNewCustomer) {
        savedCustomer = await collections.customers().create<Customer>(formData);
        toast.success('Nutzer:in erfolgreich erstellt');
        // Force reload after creating new customer to ensure clean state
        onSave?.(savedCustomer);
        onOpenChange(false);
        window.location.reload();
      } else if (customer) {
        savedCustomer = await collections.customers().update<Customer>(customer.id, formData);
        toast.success('Nutzer:in erfolgreich aktualisiert');
        onSave?.(savedCustomer);
        setIsEditMode(false);
        onOpenChange(false);
      } else {
        return;
      }
    } catch (err) {
      console.error('Error saving customer:', err);
      toast.error('Fehler beim Speichern des Nutzers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelDialog(true);
    } else {
      if (isNewCustomer) {
        onOpenChange(false);
      } else {
        setIsEditMode(false);
      }
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelDialog(false);
    if (isNewCustomer) {
      onOpenChange(false);
    } else {
      form.reset();
      setIsEditMode(false);
    }
  };

  const handleDelete = async () => {
    if (!customer?.id) return;

    setIsLoading(true);
    try {
      await collections.customers().delete(customer.id);
      toast.success('Nutzer:in erfolgreich gelöscht');
      setShowDeleteDialog(false);
      onSave?.(customer);
      onOpenChange(false);
    } catch (err) {
      console.error('Error deleting customer:', err);
      toast.error('Fehler beim Löschen des Nutzers');
    } finally {
      setIsLoading(false);
    }
  };

  const getHighlightColorBadge = (color?: HighlightColor) => {
    if (!color) return null;
    const colorMap = {
      red: 'bg-red-500',
      orange: 'bg-orange-500',
      yellow: 'bg-yellow-500',
      green: 'bg-green-500',
      teal: 'bg-teal-500',
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
      pink: 'bg-pink-500',
    };
    return (
      <Badge className={`${colorMap[color]} text-white`}>
        {color}
      </Badge>
    );
  };

  const handlePrint = () => {
    if (!customer) return;

    try {
      const printContent = generateCustomerPrintContent({
        customer,
        rentals,
        reservations,
      });

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();

        // Wait for content to load before printing
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        toast.error('Popup-Fenster wurde blockiert. Bitte erlauben Sie Pop-ups für diese Seite.');
      }
    } catch (err) {
      console.error('Error generating print content:', err);
      toast.error('Fehler beim Erstellen des Druckdokuments');
    }
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
                <div className="flex items-baseline gap-3 mb-2">
                  <SheetTitle className="text-2xl">
                    {isNewCustomer
                      ? 'Neuer Nutzer'
                      : `${customer?.firstname} ${customer?.lastname}`
                    }
                  </SheetTitle>
                  {!isNewCustomer && (
                    <span className="font-mono text-lg text-primary font-semibold">
                      #{String(customer?.iid).padStart(4, '0')}
                    </span>
                  )}
                </div>
                {!isNewCustomer && customer && (
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    {customer.email && <span>{customer.email}</span>}
                    {customer.phone && <span>•</span>}
                    {customer.phone && <span>{customer.phone}</span>}
                  </div>
                )}
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Quick Stats */}
            {!isNewCustomer && !isEditMode && (
            <div className="grid grid-cols-3 gap-4 mb-6 px-6">
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="text-sm font-medium text-muted-foreground mb-1">Aktive Leihvorgänge</div>
                <div className="text-2xl font-bold">
                  {rentals.filter(r => !r.returned_on).length}
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="text-sm font-medium text-muted-foreground mb-1">Gesamt Ausleihen</div>
                <div className="text-2xl font-bold">
                  {rentals.length}
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="text-sm font-medium text-muted-foreground mb-1">Offene Reservierungen</div>
                <div className="text-2xl font-bold">
                  {reservations.filter(r => !r.done).length}
                </div>
              </div>
            </div>
          )}

          {/* Important Alert - Highlight Color & Remark */}
          {!isNewCustomer && !isEditMode && (customer?.highlight_color || customer?.remark) && (
            <div className="px-6 mb-6">
              {customer?.highlight_color && (
                <div className={`rounded-lg p-4 mb-3 border-l-4 ${
                  customer.highlight_color === 'red' ? 'bg-red-50 dark:bg-red-950/20 border-red-500' :
                  customer.highlight_color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500' :
                  customer.highlight_color === 'blue' ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-500' :
                  customer.highlight_color === 'green' ? 'bg-green-50 dark:bg-green-950/20 border-green-500' :
                  customer.highlight_color === 'purple' ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-500' :
                  customer.highlight_color === 'orange' ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-500' :
                  customer.highlight_color === 'pink' ? 'bg-pink-50 dark:bg-pink-950/20 border-pink-500' :
                  'bg-teal-50 dark:bg-teal-950/20 border-teal-500'
                }`}>
                  <div className="flex items-center gap-2">
                    {getHighlightColorBadge(customer.highlight_color)}
                    <span className="text-sm font-medium">Markierter Nutzer</span>
                  </div>
                </div>
              )}
              {customer?.remark && (
                <div className={`rounded-lg p-4 border-l-4 ${
                  customer.highlight_color === 'red' ? 'bg-red-50 dark:bg-red-950/20 border-red-500' :
                  customer.highlight_color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500' :
                  customer.highlight_color === 'blue' ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-500' :
                  customer.highlight_color === 'green' ? 'bg-green-50 dark:bg-green-950/20 border-green-500' :
                  customer.highlight_color === 'purple' ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-500' :
                  customer.highlight_color === 'orange' ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-500' :
                  customer.highlight_color === 'pink' ? 'bg-pink-50 dark:bg-pink-950/20 border-pink-500' :
                  customer.highlight_color === 'teal' ? 'bg-teal-50 dark:bg-teal-950/20 border-teal-500' :
                  'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500'
                }`}>
                  <div className="text-base font-semibold mb-1">Wichtige Notiz:</div>
                  <p className="text-base whitespace-pre-wrap">{customer.remark}</p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={form.handleSubmit(handleSave)} className={isEditMode ? "space-y-6 px-6" : "space-y-4 px-6"}>
            {isEditMode ? (
              /* Edit Mode - Card-Based Layout */
              <>
                {/* Basic Information */}
                <section className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <UserIcon className="size-4 text-muted-foreground" />
                    <h3 className="font-semibold text-base">Basisdaten</h3>
                  </div>
                  <div className="space-y-3">
                    {/* ID on its own line */}
                    <div>
                      <Label htmlFor="iid">ID *</Label>
                      <Input
                        id="iid"
                        type="number"
                        {...form.register('iid', { valueAsNumber: true })}
                        className="mt-1.5"
                      />
                      {form.formState.errors.iid && (
                        <p className="text-sm text-destructive mt-1">
                          {form.formState.errors.iid.message}
                        </p>
                      )}
                    </div>

                    {/* Firstname and Lastname together */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="firstname">Vorname *</Label>
                        <Input
                          id="firstname"
                          {...form.register('firstname')}
                          className="mt-1.5"
                        />
                        {form.formState.errors.firstname && (
                          <p className="text-sm text-destructive mt-1">
                            {form.formState.errors.firstname.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="lastname">Nachname *</Label>
                        <Input
                          id="lastname"
                          {...form.register('lastname')}
                          className="mt-1.5"
                        />
                        {form.formState.errors.lastname && (
                          <p className="text-sm text-destructive mt-1">
                            {form.formState.errors.lastname.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Email and Phone together */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="email">E-Mail</Label>
                        <Input
                          id="email"
                          type="email"
                          {...form.register('email')}
                          className="mt-1.5"
                        />
                        {form.formState.errors.email && (
                          <p className="text-sm text-destructive mt-1">
                            {form.formState.errors.email.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="phone">Telefon</Label>
                        <Input
                          id="phone"
                          {...form.register('phone')}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Address */}
                <section className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPinIcon className="size-4 text-muted-foreground" />
                    <h3 className="font-semibold text-base">Adresse</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label htmlFor="street">Straße</Label>
                      <Input
                        id="street"
                        {...form.register('street')}
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="postal_code">PLZ</Label>
                      <Input
                        id="postal_code"
                        {...form.register('postal_code')}
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="city">Stadt</Label>
                      <Input
                        id="city"
                        {...form.register('city')}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </section>

                {/* Registration Details */}
                <section className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    <h3 className="font-semibold text-base">Registrierung</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="registered_on">Registriert am</Label>
                        <Controller
                          name="registered_on"
                          control={form.control}
                          render={({ field }) => (
                            <Input
                              id="registered_on"
                              type="date"
                              value={field.value || ''}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                              className="mt-1.5"
                            />
                          )}
                        />
                      </div>

                      <div>
                        <Label htmlFor="renewed_on">Verlängert am</Label>
                        <div className="flex gap-2 mt-1.5">
                          <Controller
                            name="renewed_on"
                            control={form.control}
                            render={({ field }) => (
                              <Input
                                id="renewed_on"
                                type="date"
                                value={field.value || ''}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                className="flex-1"
                              />
                            )}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => form.setValue('renewed_on', dateToLocalString(new Date()), { shouldDirty: true })}
                            className="px-3"
                            title="Heute"
                          >
                            Heute
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="newsletter" className="text-sm font-medium">Newsletter</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Checkbox
                          id="newsletter"
                          checked={form.watch('newsletter')}
                          onCheckedChange={(checked) => form.setValue('newsletter', checked as boolean)}
                        />
                        <span className="text-sm text-muted-foreground">Newsletter abonniert</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Additional Information */}
                <section className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <PaletteIcon className="size-4 text-muted-foreground" />
                    <h3 className="font-semibold text-base">Zusätzliche Informationen</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Markierungsfarbe</Label>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => form.setValue('highlight_color', '')}
                          className={`w-12 h-12 rounded-md border-2 transition-all bg-muted hover:bg-muted/80 flex items-center justify-center ${
                            !form.watch('highlight_color')
                              ? 'border-primary ring-2 ring-primary/20 scale-105'
                              : 'border-border hover:border-primary/50'
                          }`}
                          title="Keine Markierung"
                        >
                          <span className="text-xs text-muted-foreground font-medium">—</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => form.setValue('highlight_color', 'red')}
                          className={`w-12 h-12 rounded-md border-2 transition-all bg-red-100 dark:bg-red-950/30 ${
                            form.watch('highlight_color') === 'red'
                              ? 'border-red-500 ring-2 ring-red-500/20 scale-105'
                              : 'border-red-300 dark:border-red-800 hover:border-red-500'
                          }`}
                          title="Rot"
                        />
                        <button
                          type="button"
                          onClick={() => form.setValue('highlight_color', 'orange')}
                          className={`w-12 h-12 rounded-md border-2 transition-all bg-orange-100 dark:bg-orange-950/30 ${
                            form.watch('highlight_color') === 'orange'
                              ? 'border-orange-500 ring-2 ring-orange-500/20 scale-105'
                              : 'border-orange-300 dark:border-orange-800 hover:border-orange-500'
                          }`}
                          title="Orange"
                        />
                        <button
                          type="button"
                          onClick={() => form.setValue('highlight_color', 'yellow')}
                          className={`w-12 h-12 rounded-md border-2 transition-all bg-yellow-100 dark:bg-yellow-950/30 ${
                            form.watch('highlight_color') === 'yellow'
                              ? 'border-yellow-500 ring-2 ring-yellow-500/20 scale-105'
                              : 'border-yellow-300 dark:border-yellow-800 hover:border-yellow-500'
                          }`}
                          title="Gelb"
                        />
                        <button
                          type="button"
                          onClick={() => form.setValue('highlight_color', 'green')}
                          className={`w-12 h-12 rounded-md border-2 transition-all bg-green-100 dark:bg-green-950/30 flex items-center justify-center ${
                            form.watch('highlight_color') === 'green'
                              ? 'border-green-500 ring-2 ring-green-500/20 scale-105'
                              : 'border-green-300 dark:border-green-800 hover:border-green-500'
                          }`}
                          title="Grün"
                        >
                          <Heart className="h-5 w-5 text-green-600 dark:text-green-400 fill-green-600 dark:fill-green-400" />
                        </button>
                        <button
                          type="button"
                          onClick={() => form.setValue('highlight_color', 'teal')}
                          className={`w-12 h-12 rounded-md border-2 transition-all bg-teal-100 dark:bg-teal-950/30 ${
                            form.watch('highlight_color') === 'teal'
                              ? 'border-teal-500 ring-2 ring-teal-500/20 scale-105'
                              : 'border-teal-300 dark:border-teal-800 hover:border-teal-500'
                          }`}
                          title="Türkis"
                        />
                        <button
                          type="button"
                          onClick={() => form.setValue('highlight_color', 'blue')}
                          className={`w-12 h-12 rounded-md border-2 transition-all bg-blue-100 dark:bg-blue-950/30 ${
                            form.watch('highlight_color') === 'blue'
                              ? 'border-blue-500 ring-2 ring-blue-500/20 scale-105'
                              : 'border-blue-300 dark:border-blue-800 hover:border-blue-500'
                          }`}
                          title="Blau"
                        />
                        <button
                          type="button"
                          onClick={() => form.setValue('highlight_color', 'purple')}
                          className={`w-12 h-12 rounded-md border-2 transition-all bg-purple-100 dark:bg-purple-950/30 ${
                            form.watch('highlight_color') === 'purple'
                              ? 'border-purple-500 ring-2 ring-purple-500/20 scale-105'
                              : 'border-purple-300 dark:border-purple-800 hover:border-purple-500'
                          }`}
                          title="Lila"
                        />
                        <button
                          type="button"
                          onClick={() => form.setValue('highlight_color', 'pink')}
                          className={`w-12 h-12 rounded-md border-2 transition-all bg-pink-100 dark:bg-pink-950/30 ${
                            form.watch('highlight_color') === 'pink'
                              ? 'border-pink-500 ring-2 ring-pink-500/20 scale-105'
                              : 'border-pink-300 dark:border-pink-800 hover:border-pink-500'
                          }`}
                          title="Rosa"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="remark">Bemerkung</Label>
                      <Textarea
                        id="remark"
                        {...form.register('remark')}
                        className="mt-1.5"
                        rows={3}
                      />
                    </div>
                  </div>
                </section>
              </>
            ) : (
              /* View Mode - Card-Based Layout */
              <>
                {/* Contact Information Card */}
                <section>
                  <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    {customer?.email && (
                      <div className="flex items-center gap-3">
                        <MailIcon className="size-5 text-muted-foreground shrink-0" />
                        <a href={`mailto:${customer.email}`} className="text-base hover:underline">
                          {customer.email}
                        </a>
                      </div>
                    )}
                    {customer?.phone && (
                      <div className="flex items-center gap-3">
                        <PhoneIcon className="size-5 text-muted-foreground shrink-0" />
                        <a href={`tel:${customer.phone}`} className="text-base hover:underline">
                          {customer.phone}
                        </a>
                      </div>
                    )}
                    {(!customer?.email && !customer?.phone) && (
                      <p className="text-sm text-muted-foreground italic">Keine Kontaktinformationen hinterlegt</p>
                    )}
                  </div>
                </section>

                {/* Address Card (only if exists) */}
                {(customer?.street || customer?.city) && (
                  <section>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-start gap-3">
                        <MapPinIcon className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="text-base">
                          {customer?.street && <div>{customer.street}</div>}
                          {(customer?.postal_code || customer?.city) && (
                            <div>{customer?.postal_code} {customer?.city}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Metadata Row */}
                <section>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="size-4" />
                      <span>Registriert: {customer ? formatDate(customer.registered_on) : '—'}</span>
                    </div>
                    {customer?.renewed_on && (
                      <div className="flex items-center gap-2">
                        <span>•</span>
                        <span>Verlängert: {formatDate(customer.renewed_on)}</span>
                      </div>
                    )}
                    {customer?.newsletter && (
                      <div className="flex items-center gap-2">
                        <span>•</span>
                        <Badge variant="secondary" className="text-xs">Newsletter</Badge>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            {/* Reservation History */}
            {!isNewCustomer && (
              <section className="space-y-3">
                <div className="border-b pb-1 mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-base">Reservierungen</h3>
                  {reservations.length > 5 && !isEditMode && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllReservations(!showAllReservations)}
                      className="text-xs"
                    >
                      {showAllReservations ? 'Weniger anzeigen' : `Alle ${reservations.length} anzeigen`}
                    </Button>
                  )}
                </div>
                {isLoadingHistory ? (
                  <div className="flex justify-center py-4">
                    <div className="h-6 w-6 animate-spin border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : reservations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center bg-muted/30 rounded-md">
                    Keine Reservierungen
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/70">
                        <tr className="border-b">
                          <th className="px-3 py-2 text-left font-semibold">Abholung</th>
                          <th className="px-3 py-2 text-left font-semibold">Artikel</th>
                          <th className="px-3 py-2 text-left font-semibold">Status</th>
                          <th className="px-3 py-2 text-left font-semibold">Kommentar</th>
                        </tr>
                      </thead>
                      <tbody className="bg-background">
                        {(showAllReservations ? reservations : reservations.slice(0, 5)).map((reservation) => {
                          const items = reservation.expand?.items || [];
                          const firstItem = items[0];
                          const additionalCount = items.length - 1;

                          return (
                            <tr key={reservation.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2 font-medium">{formatDate(reservation.pickup)}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {firstItem ? (
                                  <>
                                    <span className="font-mono text-xs">
                                      {String(firstItem.iid).padStart(4, '0')}
                                    </span>
                                    {' '}
                                    {firstItem.name}
                                    {additionalCount > 0 && (
                                      <span className="text-xs ml-1">
                                        +{additionalCount}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant={reservation.done ? 'secondary' : 'default'}>
                                  {reservation.done ? 'Erledigt' : 'Offen'}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{reservation.comments || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Rental History */}
            {!isNewCustomer && (
              <section className="space-y-3">
                <div className="border-b pb-1 mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-base">Leihverlauf</h3>
                  {rentals.length > 5 && !isEditMode && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllRentals(!showAllRentals)}
                      className="text-xs"
                    >
                      {showAllRentals ? 'Weniger anzeigen' : `Alle ${rentals.length} anzeigen`}
                    </Button>
                  )}
                </div>
                {isLoadingHistory ? (
                  <div className="flex justify-center py-4">
                    <div className="h-6 w-6 animate-spin border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : rentals.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center bg-muted/30 rounded-md">
                    Keine Leihvorgänge
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/70">
                        <tr className="border-b">
                          <th className="px-3 py-2 text-left font-semibold">Ausgeliehen</th>
                          <th className="px-3 py-2 text-left font-semibold">Zurückgegeben</th>
                          <th className="px-3 py-2 text-left font-semibold">Artikel</th>
                          <th className="px-3 py-2 text-left font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-background">
                        {(showAllRentals ? rentals : rentals.slice(0, 5)).map((rental) => {
                          const status = calculateRentalStatus(
                            rental.rented_on,
                            rental.returned_on,
                            rental.expected_on,
                            rental.extended_on
                          );
                          return (
                            <tr key={rental.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2 font-medium">{formatDate(rental.rented_on)}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {rental.returned_on ? formatDate(rental.returned_on) : '—'}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {rental.expand?.items?.length || 0} Artikel
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant={status === 'overdue' ? 'destructive' : 'secondary'}>
                                  {getRentalStatusLabel(status)}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </form>
          </div>

          {isEditMode ? (
            <SheetFooter className="border-t pt-4 px-6 shrink-0 bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                <XIcon className="size-4 mr-2" />
                Abbrechen
              </Button>
              <Button
                type="submit"
                onClick={form.handleSubmit(handleSave)}
                disabled={isLoading}
              >
                <SaveIcon className="size-4 mr-2" />
                {isLoading ? 'Speichern...' : 'Speichern'}
              </Button>
            </SheetFooter>
          ) : !isNewCustomer && (
            <SheetFooter className="border-t pt-4 px-6 shrink-0 bg-background">
              <div className="flex justify-between w-full gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    <XIcon className="size-4 mr-2" />
                    Schließen
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isLoading}
                  >
                    <Trash2Icon className="size-4 mr-2" />
                    Löschen
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handlePrint}
                  >
                    <PrinterIcon className="size-4 mr-2" />
                    Drucken
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditMode(true)}
                  >
                    <PencilIcon className="size-4 mr-2" />
                    Bearbeiten
                  </Button>
                </div>
              </div>
            </SheetFooter>
          )}
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
            <DialogTitle>Nutzer löschen?</DialogTitle>
            <DialogDescription>
              Möchten Sie diesen Nutzer wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
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
