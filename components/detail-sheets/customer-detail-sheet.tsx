/**
 * Customer Detail Sheet Component
 * Displays and edits customer information with rental/reservation history
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PencilIcon, SaveIcon, XIcon } from 'lucide-react';
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
import { formatDate, formatCurrency, calculateRentalStatus } from '@/lib/utils/formatting';
import type { Customer, CustomerFormData, Rental, RentalExpanded, Reservation, ReservationExpanded, HighlightColor } from '@/types';

// Validation schema
const customerSchema = z.object({
  firstname: z.string().min(1, 'Vorname ist erforderlich'),
  lastname: z.string().min(1, 'Nachname ist erforderlich'),
  email: z.string().email('Ungültige E-Mail-Adresse').optional().or(z.literal('')),
  phone: z.string().optional(),
  street: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  registered_on: z.string(),
  renewed_on: z.string().optional(),
  heard: z.string().optional(),
  newsletter: z.boolean(),
  remark: z.string().optional(),
  highlight_color: z.enum(['green', 'blue', 'yellow', 'red', '']).optional(),
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
  const [rentals, setRentals] = useState<RentalExpanded[]>([]);
  const [reservations, setReservations] = useState<ReservationExpanded[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const isNewCustomer = !customer?.id;

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      firstname: '',
      lastname: '',
      email: '',
      phone: '',
      street: '',
      postal_code: '',
      city: '',
      registered_on: new Date().toISOString().split('T')[0],
      renewed_on: '',
      heard: '',
      newsletter: false,
      remark: '',
      highlight_color: '',
    },
  });

  const { formState: { isDirty } } = form;

  // Load customer data when customer changes
  useEffect(() => {
    if (customer) {
      form.reset({
        firstname: customer.firstname,
        lastname: customer.lastname,
        email: customer.email || '',
        phone: customer.phone || '',
        street: customer.street || '',
        postal_code: customer.postal_code || '',
        city: customer.city || '',
        registered_on: customer.registered_on.split('T')[0],
        renewed_on: customer.renewed_on?.split('T')[0] || '',
        heard: customer.heard || '',
        newsletter: customer.newsletter,
        remark: customer.remark || '',
        highlight_color: (customer.highlight_color || '') as '' | 'green' | 'blue' | 'yellow' | 'red',
      });
      setIsEditMode(false);
    } else if (isNewCustomer) {
      form.reset({
        firstname: '',
        lastname: '',
        email: '',
        phone: '',
        street: '',
        postal_code: '',
        city: '',
        registered_on: new Date().toISOString().split('T')[0],
        renewed_on: '',
        heard: '',
        newsletter: false,
        remark: '',
        highlight_color: '',
      });
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
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email || undefined,
        phone: data.phone || undefined,
        street: data.street || undefined,
        postal_code: data.postal_code || undefined,
        city: data.city || undefined,
        registered_on: data.registered_on,
        renewed_on: data.renewed_on || undefined,
        heard: data.heard || undefined,
        newsletter: data.newsletter,
        remark: data.remark || undefined,
        highlight_color: (data.highlight_color as HighlightColor) || undefined,
      };

      let savedCustomer: Customer;
      if (isNewCustomer) {
        savedCustomer = await collections.customers().create<Customer>(formData);
        toast.success('Kunde erfolgreich erstellt');
      } else if (customer) {
        savedCustomer = await collections.customers().update<Customer>(customer.id, formData);
        toast.success('Kunde erfolgreich aktualisiert');
      } else {
        return;
      }

      onSave?.(savedCustomer);
      setIsEditMode(false);
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving customer:', err);
      toast.error('Fehler beim Speichern des Kunden');
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

  const getHighlightColorBadge = (color?: HighlightColor) => {
    if (!color) return null;
    const colorMap = {
      green: 'bg-green-500',
      blue: 'bg-blue-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
    };
    return (
      <Badge className={`${colorMap[color]} text-white`}>
        {color}
      </Badge>
    );
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
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader className="border-b pb-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-baseline gap-3 mb-2">
                  <SheetTitle className="text-2xl">
                    {isNewCustomer
                      ? 'Neuer Kunde'
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
              {!isNewCustomer && !isEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditMode(true)}
                >
                  <PencilIcon className="size-4 mr-2" />
                  Bearbeiten
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Quick Stats */}
          {!isNewCustomer && !isEditMode && (
            <div className="grid grid-cols-3 gap-4 mb-6">
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

          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-8">
            {/* Basic Information */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Basisdaten</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstname">Vorname *</Label>
                  {isEditMode ? (
                    <Input
                      id="firstname"
                      {...form.register('firstname')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{customer?.firstname || '—'}</p>
                  )}
                  {form.formState.errors.firstname && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.firstname.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="lastname">Nachname *</Label>
                  {isEditMode ? (
                    <Input
                      id="lastname"
                      {...form.register('lastname')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{customer?.lastname || '—'}</p>
                  )}
                  {form.formState.errors.lastname && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.lastname.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email">E-Mail</Label>
                  {isEditMode ? (
                    <Input
                      id="email"
                      type="email"
                      {...form.register('email')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{customer?.email || '—'}</p>
                  )}
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  {isEditMode ? (
                    <Input
                      id="phone"
                      {...form.register('phone')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{customer?.phone || '—'}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Address */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Adresse</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="street">Straße</Label>
                  {isEditMode ? (
                    <Input
                      id="street"
                      {...form.register('street')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{customer?.street || '—'}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="postal_code">PLZ</Label>
                  {isEditMode ? (
                    <Input
                      id="postal_code"
                      {...form.register('postal_code')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{customer?.postal_code || '—'}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="city">Stadt</Label>
                  {isEditMode ? (
                    <Input
                      id="city"
                      {...form.register('city')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{customer?.city || '—'}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Registration Details */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Registrierung</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="registered_on">Registriert am</Label>
                  {isEditMode ? (
                    <Input
                      id="registered_on"
                      type="date"
                      {...form.register('registered_on')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">
                      {customer ? formatDate(customer.registered_on) : '—'}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="renewed_on">Verlängert am</Label>
                  {isEditMode ? (
                    <Input
                      id="renewed_on"
                      type="date"
                      {...form.register('renewed_on')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">
                      {customer?.renewed_on ? formatDate(customer.renewed_on) : '—'}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="heard">Gehört über</Label>
                  {isEditMode ? (
                    <Input
                      id="heard"
                      {...form.register('heard')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{customer?.heard || '—'}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="newsletter">Newsletter</Label>
                  {isEditMode ? (
                    <div className="flex items-center mt-1">
                      <input
                        id="newsletter"
                        type="checkbox"
                        {...form.register('newsletter')}
                        className="mr-2"
                      />
                      <span className="text-sm">Abonniert</span>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm">
                      {customer?.newsletter ? 'Ja' : 'Nein'}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Additional Information */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Zusätzliche Informationen</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="highlight_color">Markierungsfarbe</Label>
                  {isEditMode ? (
                    <select
                      id="highlight_color"
                      {...form.register('highlight_color')}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Keine</option>
                      <option value="green">Grün</option>
                      <option value="blue">Blau</option>
                      <option value="yellow">Gelb</option>
                      <option value="red">Rot</option>
                    </select>
                  ) : (
                    <div className="mt-1">
                      {getHighlightColorBadge(customer?.highlight_color) || <span className="text-sm">—</span>}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="remark">Bemerkung</Label>
                  {isEditMode ? (
                    <Textarea
                      id="remark"
                      {...form.register('remark')}
                      className="mt-1"
                      rows={3}
                    />
                  ) : (
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {customer?.remark || '—'}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Reservation History */}
            {!isNewCustomer && (
              <section className="space-y-4">
                <div className="border-b pb-2 mb-4">
                  <h3 className="font-semibold text-lg">Reservierungen</h3>
                </div>
                {isLoadingHistory ? (
                  <div className="flex justify-center py-4">
                    <div className="h-6 w-6 animate-spin border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : reservations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-md">
                    Keine Reservierungen
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/70">
                        <tr className="border-b">
                          <th className="px-4 py-3 text-left font-semibold">Abholung</th>
                          <th className="px-4 py-3 text-left font-semibold">Artikel</th>
                          <th className="px-4 py-3 text-left font-semibold">Status</th>
                          <th className="px-4 py-3 text-left font-semibold">Kommentar</th>
                        </tr>
                      </thead>
                      <tbody className="bg-background">
                        {reservations.map((reservation) => (
                          <tr key={reservation.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{formatDate(reservation.pickup)}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {reservation.expand?.items?.length || 0} Artikel
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={reservation.done ? 'secondary' : 'default'}>
                                {reservation.done ? 'Erledigt' : 'Offen'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{reservation.comments || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Rental History */}
            {!isNewCustomer && (
              <section className="space-y-4">
                <div className="border-b pb-2 mb-4">
                  <h3 className="font-semibold text-lg">Leihverlauf</h3>
                </div>
                {isLoadingHistory ? (
                  <div className="flex justify-center py-4">
                    <div className="h-6 w-6 animate-spin border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : rentals.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-md">
                    Keine Leihvorgänge
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/70">
                        <tr className="border-b">
                          <th className="px-4 py-3 text-left font-semibold">Ausgeliehen</th>
                          <th className="px-4 py-3 text-left font-semibold">Erwartet</th>
                          <th className="px-4 py-3 text-left font-semibold">Zurückgegeben</th>
                          <th className="px-4 py-3 text-left font-semibold">Artikel</th>
                          <th className="px-4 py-3 text-left font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-background">
                        {rentals.map((rental) => {
                          const status = calculateRentalStatus(
                            rental.rented_on,
                            rental.returned_on,
                            rental.expected_on,
                            rental.extended_on
                          );
                          return (
                            <tr key={rental.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-medium">{formatDate(rental.rented_on)}</td>
                              <td className="px-4 py-3 text-muted-foreground">{formatDate(rental.expected_on)}</td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {rental.returned_on ? formatDate(rental.returned_on) : '—'}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {rental.expand?.items?.length || 0} Artikel
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={status === 'overdue' ? 'destructive' : 'secondary'}>
                                  {status}
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

          {isEditMode && (
            <SheetFooter className="border-t pt-4">
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
    </>
  );
}
