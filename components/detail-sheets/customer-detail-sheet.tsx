/**
 * Customer Detail Sheet Component
 * Displays and edits customer information with rental/reservation history
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { collections } from '@/lib/pocketbase/client';
import { formatDate, calculateRentalStatus, dateToLocalString, formatPhoneNumber, formatPhoneNumberForTel, isValidPhoneNumber, toBusinessDay } from '@/lib/utils/formatting';
import { fetchNextIid } from '@/lib/utils/next-iid';
import { getRentalStatusLabel } from '@/lib/constants/statuses';
import { generateCustomerPrintContent } from '@/components/print/customer-print-content';
import type { Customer, RentalExpanded, ReservationExpanded, HighlightColor } from '@/types';
import { FormHelpPanel } from './form-help-panel';
import { HighlightColorPicker } from './highlight-color-picker';
import { DOCUMENTATION } from '@/lib/constants/documentation';
import { useHelpCollapsed } from '@/hooks/use-help-collapsed';

// Validation schema
const customerSchema = z.object({
  iid: z.number({ error: 'ID ist erforderlich' }).int().min(1, 'ID muss mindestens 1 sein'),
  firstname: z.string().min(1, 'Vorname ist erforderlich'),
  lastname: z.string().min(1, 'Nachname ist erforderlich'),
  // Optional at the schema level so legacy customers without email/phone
  // can still be opened for editing. If provided, email must be valid.
  email: z
    .string()
    .email('Ungültige E-Mail-Adresse')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((val) => isValidPhoneNumber(val ?? ''), { message: 'Ungültige Telefonnummer' }),
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

// Empty value for the iid number input (until the next free iid has loaded,
// or when it couldn't be). form.reset({ iid: undefined }) does NOT clear an
// uncontrolled number input; an empty string does.
const EMPTY_IID = '' as unknown as number;

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
  // Synchronous double-submit guard for handleSave (Enter in a field submits
  // the form even while the save button is disabled).
  const isSavingRef = useRef(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  // Whether confirming "Verwerfen" also closes the sheet (the dialog was
  // opened by closing the sheet rather than by "Abbrechen")
  const [closeOnDiscard, setCloseOnDiscard] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { isCollapsed: isHelpCollapsed, toggle: toggleHelp } = useHelpCollapsed();
  const [rentals, setRentals] = useState<RentalExpanded[]>([]);
  const [reservations, setReservations] = useState<ReservationExpanded[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showAllRentals, setShowAllRentals] = useState(false);
  const [showAllReservations, setShowAllReservations] = useState(false);

  // Date picker state
  const [registeredOnPickerOpen, setRegisteredOnPickerOpen] = useState(false);
  const [renewedOnPickerOpen, setRenewedOnPickerOpen] = useState(false);

  const isNewCustomer = !customer?.id;

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      iid: EMPTY_IID,
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

  // Load customer data when the sheet opens or the customer changes. Gated on
  // (and re-run by) `open`: after creating a customer the parent passes null
  // again, so without it clicking "Neu" a second time would keep the old form.
  useEffect(() => {
    if (!open) return;
    if (customer && customer.id) {
      // Existing customer - load all data
      const formData = {
        iid: customer.iid,
        firstname: customer.firstname,
        lastname: customer.lastname,
        email: customer.email || '',
        phone: formatPhoneNumber(customer.phone || ''),
        street: customer.street || '',
        postal_code: customer.postal_code || '',
        city: customer.city || '',
        // Calendar day (YYYY-MM-DD) of the stored date; see toBusinessDay
        registered_on: toBusinessDay(customer.registered_on),
        renewed_on: toBusinessDay(customer.renewed_on),
        newsletter: customer.newsletter,
        remark: customer.remark || '',
        highlight_color: (customer.highlight_color || '') as '' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink',
      };
      form.reset(formData);
      setIsEditMode(false);
      return;
    }

    // New customer, possibly with partial data to pre-fill (e.g. from a
    // reservation). Reset right away so no previous draft lingers; the iid
    // stays empty until the next free one has loaded.
    const newCustomerValues: CustomerFormValues = {
      iid: EMPTY_IID,
      firstname: customer?.firstname || '',
      lastname: customer?.lastname || '',
      email: customer?.email || '',
      phone: formatPhoneNumber(customer?.phone || ''),
      street: customer?.street || '',
      postal_code: customer?.postal_code || '',
      city: customer?.city || '',
      registered_on: dateToLocalString(new Date()),
      renewed_on: '',
      newsletter: false,
      remark: '',
      highlight_color: '',
    };
    form.reset(newCustomerValues);
    setIsEditMode(true);

    let cancelled = false;
    fetchNextIid(collections.customers())
      .then((nextIid) => {
        if (!cancelled) form.reset({ ...newCustomerValues, iid: nextIid });
      })
      .catch((err) => {
        if (cancelled) return;
        // Don't propose a fallback iid: on a network/auth error 1 (or any
        // guess) is almost certainly taken.
        console.error('Error fetching next IID:', err);
        toast.error('Nächste freie ID konnte nicht geladen werden. Bitte ID manuell eintragen.');
      });
    return () => {
      cancelled = true;
    };
  }, [customer, form, open]);

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

  // Id of a field's validation message, and the aria props linking the
  // field to it while it is shown
  const errorId = (field: keyof CustomerFormValues) => `customer-${field}-error`;
  const errorProps = (field: keyof CustomerFormValues) => {
    const invalid = !!form.formState.errors[field];
    return {
      'aria-invalid': invalid || undefined,
      'aria-describedby': invalid ? errorId(field) : undefined,
    };
  };

  const handleSave = async (data: CustomerFormValues) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsLoading(true);
    try {
      // Cleared optional fields are sent as '' rather than undefined: PATCH
      // only updates fields present in the body, and JSON drops undefined.
      const formData: Partial<Customer> = {
        iid: data.iid,
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email ?? '',
        phone: formatPhoneNumber(data.phone || ''),
        street: data.street ?? '',
        postal_code: data.postal_code ?? '',
        city: data.city ?? '',
        registered_on: data.registered_on,
        renewed_on: data.renewed_on ?? '',
        newsletter: data.newsletter,
        remark: data.remark ?? '',
        highlight_color: data.highlight_color ? (data.highlight_color as HighlightColor) : '',
      };

      let savedCustomer: Customer;
      if (isNewCustomer) {
        savedCustomer = await collections.customers().create<Customer>(formData);
        toast.success('Nutzer:in erfolgreich erstellt');
        // No inline reset needed: reopening the sheet re-runs the load
        // effect (gated on `open`), which resets the form and fetches a
        // fresh iid.
        onSave?.(savedCustomer);
        onOpenChange(false);
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
      isSavingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setCloseOnDiscard(false);
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
      if (closeOnDiscard) onOpenChange(false);
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
      <span className={`inline-block w-4 h-4 rounded ${colorMap[color]}`} />
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
          setCloseOnDiscard(true);
          setShowCancelDialog(true);
        } else {
          onOpenChange(open);
        }
      }}>
        <SheetContent
          className="w-full sm:max-w-4xl flex flex-col overflow-hidden"
          overlayContent={
            isEditMode ? (
              <FormHelpPanel
                content={DOCUMENTATION.customerForm}
                isCollapsed={isHelpCollapsed}
                onToggle={toggleHelp}
              />
            ) : undefined
          }
        >
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
                    {customer.phone && <span>{formatPhoneNumber(customer.phone)}</span>}
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
                        {...errorProps('iid')}
                        className="mt-1.5"
                      />
                      {form.formState.errors.iid && (
                        <p id={errorId('iid')} className="text-sm text-destructive mt-1">
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
                          {...errorProps('firstname')}
                          className="mt-1.5"
                        />
                        {form.formState.errors.firstname && (
                          <p id={errorId('firstname')} className="text-sm text-destructive mt-1">
                            {form.formState.errors.firstname.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="lastname">Nachname *</Label>
                        <Input
                          id="lastname"
                          {...form.register('lastname')}
                          {...errorProps('lastname')}
                          className="mt-1.5"
                        />
                        {form.formState.errors.lastname && (
                          <p id={errorId('lastname')} className="text-sm text-destructive mt-1">
                            {form.formState.errors.lastname.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Email and Phone together */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="email">E-Mail *</Label>
                        <Input
                          id="email"
                          type="email"
                          {...form.register('email')}
                          {...errorProps('email')}
                          className="mt-1.5"
                        />
                        {form.formState.errors.email && (
                          <p id={errorId('email')} className="text-sm text-destructive mt-1">
                            {form.formState.errors.email.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="phone">Telefon *</Label>
                        <Input
                          id="phone"
                          {...form.register('phone')}
                          {...errorProps('phone')}
                          className="mt-1.5"
                        />
                        {form.formState.errors.phone && (
                          <p id={errorId('phone')} className="text-sm text-destructive mt-1">
                            {form.formState.errors.phone.message}
                          </p>
                        )}
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
                        <div className="relative mt-1.5">
                          <Input
                            id="registered_on"
                            value={form.watch('registered_on') ? new Date(form.watch('registered_on')).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                            placeholder="Datum auswählen..."
                            className="bg-background pr-10 cursor-pointer"
                            readOnly
                            onClick={() => setRegisteredOnPickerOpen(true)}
                          />
                          <Popover open={registeredOnPickerOpen} onOpenChange={setRegisteredOnPickerOpen}>
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
                                selected={form.watch('registered_on') ? new Date(form.watch('registered_on')) : undefined}
                                captionLayout="dropdown"
                                startMonth={new Date(2020, 0)}
                                endMonth={new Date(2030, 11)}
                                onSelect={(date) => {
                                  if (date) {
                                    form.setValue('registered_on', dateToLocalString(date), { shouldDirty: true });
                                  }
                                  setRegisteredOnPickerOpen(false);
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="renewed_on">Verlängert am</Label>
                        <div className="flex gap-2 mt-1.5">
                          <div className="relative flex-1">
                            <Input
                              id="renewed_on"
                              value={form.watch('renewed_on') ? new Date(form.watch('renewed_on')!).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                              placeholder="Datum auswählen..."
                              className="bg-background pr-10 cursor-pointer"
                              readOnly
                              onClick={() => setRenewedOnPickerOpen(true)}
                            />
                            <Popover open={renewedOnPickerOpen} onOpenChange={setRenewedOnPickerOpen}>
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
                                  selected={form.watch('renewed_on') ? new Date(form.watch('renewed_on')!) : undefined}
                                  captionLayout="dropdown"
                                  startMonth={new Date(2020, 0)}
                                  endMonth={new Date(2030, 11)}
                                  onSelect={(date) => {
                                    if (date) {
                                      form.setValue('renewed_on', dateToLocalString(date), { shouldDirty: true });
                                    }
                                    setRenewedOnPickerOpen(false);
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
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
                      <Label id="customer-highlight-color-label" className="text-sm font-medium mb-2 block">Markierungsfarbe</Label>
                      <HighlightColorPicker
                        value={form.watch('highlight_color')}
                        onChange={(color) => form.setValue('highlight_color', color, { shouldDirty: true })}
                        labelledBy="customer-highlight-color-label"
                        swatchClassName="w-12 h-12"
                        className="mt-2"
                        icons={{
                          green: <Heart aria-hidden="true" className="h-5 w-5 text-green-600 dark:text-green-400 fill-green-600 dark:fill-green-400" />,
                        }}
                      />
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
                        <a href={`tel:${formatPhoneNumberForTel(customer.phone)}`} className="text-base hover:underline">
                          {formatPhoneNumber(customer.phone)}
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
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        [customer?.street, customer?.postal_code, customer?.city].filter(Boolean).join(', ')
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border rounded-lg p-4 bg-muted/30 hover:bg-muted/50 hover:underline transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <MapPinIcon className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="text-base">
                          {customer?.street && <div>{customer.street}</div>}
                          {(customer?.postal_code || customer?.city) && (
                            <div>{customer?.postal_code} {customer?.city}</div>
                          )}
                        </div>
                      </div>
                    </a>
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
                              <td className="px-3 py-2">
                                {firstItem ? (
                                  <div className="flex flex-wrap gap-1 items-center">
                                    <span className="inline-flex items-center gap-1 border-2 border-border rounded-md pr-1 font-mono text-xs">
                                      <span className="inline-flex items-center justify-center bg-red-500 text-white font-bold px-1.5 py-0.5 rounded text-xs">
                                        {String(firstItem.iid).padStart(4, '0').substring(0, 2)}
                                      </span>
                                      <span className="font-semibold px-0.5">
                                        {String(firstItem.iid).padStart(4, '0').substring(2, 4)}
                                      </span>
                                    </span>
                                    <span className="text-muted-foreground truncate max-w-[200px]">
                                      {firstItem.name}
                                    </span>
                                    {additionalCount > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        +{additionalCount}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
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
                          const status = calculateRentalStatus(rental);
                          const items = rental.expand?.items || [];
                          const firstItem = items[0];
                          const additionalCount = items.length - 1;

                          return (
                            <tr key={rental.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2 font-medium">{formatDate(rental.rented_on)}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {rental.returned_on ? formatDate(rental.returned_on) : '—'}
                              </td>
                              <td className="px-3 py-2">
                                {firstItem ? (
                                  <div className="flex flex-wrap gap-1 items-center">
                                    <span className="inline-flex items-center gap-1 border-2 border-border rounded-md pr-1 font-mono text-xs">
                                      <span className="inline-flex items-center justify-center bg-red-500 text-white font-bold px-1.5 py-0.5 rounded text-xs">
                                        {String(firstItem.iid).padStart(4, '0').substring(0, 2)}
                                      </span>
                                      <span className="font-semibold px-0.5">
                                        {String(firstItem.iid).padStart(4, '0').substring(2, 4)}
                                      </span>
                                    </span>
                                    <span className="text-muted-foreground truncate max-w-[200px]">
                                      {firstItem.name}
                                    </span>
                                    {additionalCount > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        +{additionalCount}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
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
