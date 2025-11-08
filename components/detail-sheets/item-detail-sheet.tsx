/**
 * Item Detail Sheet Component
 * Displays and edits item information with rental history
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
import type { Item, ItemFormData, RentalExpanded, ItemCategory, ItemStatus, HighlightColor } from '@/types';

// Validation schema
const itemSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  brand: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
  category: z.array(z.enum(['kitchen', 'household', 'garden', 'kids', 'leisure', 'diy', 'other'])),
  deposit: z.number().min(0, 'Kaution muss positiv sein'),
  synonyms: z.string().optional(), // Comma-separated
  packaging: z.string().optional(),
  manual: z.string().optional(),
  parts: z.string().optional(),
  copies: z.number().int().min(1, 'Anzahl muss mindestens 1 sein'),
  status: z.enum(['instock', 'outofstock', 'reserved', 'onbackorder', 'lost', 'repairing', 'forsale', 'deleted']),
  highlight_color: z.enum(['green', 'blue', 'yellow', 'red', '']).optional(),
  internal_note: z.string().optional(),
  added_on: z.string(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

interface ItemDetailSheetProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (item: Item) => void;
}

export function ItemDetailSheet({
  item,
  open,
  onOpenChange,
  onSave,
}: ItemDetailSheetProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [rentals, setRentals] = useState<RentalExpanded[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const isNewItem = !item?.id;

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: '',
      brand: '',
      model: '',
      description: '',
      category: [],
      deposit: 0,
      synonyms: '',
      packaging: '',
      manual: '',
      parts: '',
      copies: 1,
      status: 'instock',
      highlight_color: '',
      internal_note: '',
      added_on: new Date().toISOString().split('T')[0],
    },
  });

  const { formState: { isDirty } } = form;

  // Load item data when item changes
  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        brand: item.brand || '',
        model: item.model || '',
        description: item.description || '',
        category: item.category as ItemCategory[],
        deposit: item.deposit,
        synonyms: item.synonyms?.join(', ') || '',
        packaging: item.packaging || '',
        manual: item.manual || '',
        parts: item.parts || '',
        copies: item.copies,
        status: item.status,
        highlight_color: (item.highlight_color || '') as '' | 'green' | 'blue' | 'yellow' | 'red',
        internal_note: item.internal_note || '',
        added_on: item.added_on.split('T')[0],
      });
      setIsEditMode(false);
    } else if (isNewItem) {
      form.reset({
        name: '',
        brand: '',
        model: '',
        description: '',
        category: [],
        deposit: 0,
        synonyms: '',
        packaging: '',
        manual: '',
        parts: '',
        copies: 1,
        status: 'instock',
        highlight_color: '',
        internal_note: '',
        added_on: new Date().toISOString().split('T')[0],
      });
      setIsEditMode(true);
    }
  }, [item, isNewItem, form]);

  // Load rental history
  useEffect(() => {
    if (item?.id && open) {
      loadHistory();
    }
  }, [item?.id, open]);

  const loadHistory = async () => {
    if (!item?.id) return;

    setIsLoadingHistory(true);
    try {
      // Load rentals that include this item
      const rentalsResult = await collections.rentals().getList<RentalExpanded>(1, 50, {
        filter: `items~"${item.id}"`,
        sort: '-rented_on',
        expand: 'customer,items',
      });
      setRentals(rentalsResult.items);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSave = async (data: ItemFormValues) => {
    setIsLoading(true);
    try {
      const formData: Partial<Item> = {
        name: data.name,
        brand: data.brand || undefined,
        model: data.model || undefined,
        description: data.description || undefined,
        category: data.category as ItemCategory[],
        deposit: data.deposit,
        synonyms: data.synonyms ? data.synonyms.split(',').map(s => s.trim()).filter(Boolean) : [],
        packaging: data.packaging || undefined,
        manual: data.manual || undefined,
        parts: data.parts || undefined,
        copies: data.copies,
        status: data.status as ItemStatus,
        highlight_color: (data.highlight_color as HighlightColor) || undefined,
        internal_note: data.internal_note || undefined,
        added_on: data.added_on,
      };

      let savedItem: Item;
      if (isNewItem) {
        savedItem = await collections.items().create<Item>(formData);
        toast.success('Artikel erfolgreich erstellt');
      } else if (item) {
        savedItem = await collections.items().update<Item>(item.id, formData);
        toast.success('Artikel erfolgreich aktualisiert');
      } else {
        return;
      }

      onSave?.(savedItem);
      setIsEditMode(false);
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving item:', err);
      toast.error('Fehler beim Speichern des Artikels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelDialog(true);
    } else {
      if (isNewItem) {
        onOpenChange(false);
      } else {
        setIsEditMode(false);
      }
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelDialog(false);
    if (isNewItem) {
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

  const getStatusBadge = (status: ItemStatus) => {
    const statusMap = {
      instock: { label: 'Auf Lager', variant: 'default' as const },
      outofstock: { label: 'Ausgeliehen', variant: 'secondary' as const },
      reserved: { label: 'Reserviert', variant: 'secondary' as const },
      onbackorder: { label: 'Nachbestellt', variant: 'secondary' as const },
      lost: { label: 'Verloren', variant: 'destructive' as const },
      repairing: { label: 'Reparatur', variant: 'secondary' as const },
      forsale: { label: 'Zu verkaufen', variant: 'secondary' as const },
      deleted: { label: 'Gelöscht', variant: 'destructive' as const },
    };
    const { label, variant } = statusMap[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const categoryLabels = {
    kitchen: 'Küche',
    household: 'Haushalt',
    garden: 'Garten',
    kids: 'Kinder',
    leisure: 'Freizeit',
    diy: 'Heimwerken',
    other: 'Sonstiges',
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
          <SheetHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle>
                {isNewItem ? 'Neuer Artikel' : `Artikel #${String(item?.iid).padStart(4, '0')}`}
              </SheetTitle>
              {!isNewItem && !isEditMode && (
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

          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6 py-6">
            {/* Basic Information */}
            <section>
              <h3 className="font-semibold text-lg mb-4">Basisdaten</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Name *</Label>
                  {isEditMode ? (
                    <Input
                      id="name"
                      {...form.register('name')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm font-medium">{item?.name || '—'}</p>
                  )}
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="brand">Marke</Label>
                  {isEditMode ? (
                    <Input
                      id="brand"
                      {...form.register('brand')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{item?.brand || '—'}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="model">Modell</Label>
                  {isEditMode ? (
                    <Input
                      id="model"
                      {...form.register('model')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{item?.model || '—'}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <Label htmlFor="description">Beschreibung</Label>
                  {isEditMode ? (
                    <Textarea
                      id="description"
                      {...form.register('description')}
                      className="mt-1"
                      rows={3}
                    />
                  ) : (
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {item?.description || '—'}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="category">Kategorien *</Label>
                  {isEditMode ? (
                    <select
                      id="category"
                      {...form.register('category')}
                      multiple
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item?.category && item.category.length > 0 ? (
                        item.category.map((cat) => (
                          <Badge key={cat} variant="secondary">
                            {categoryLabels[cat as keyof typeof categoryLabels]}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm">—</span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {isEditMode && 'Halten Sie Strg/Cmd für Mehrfachauswahl'}
                  </p>
                </div>

                <div>
                  <Label htmlFor="deposit">Kaution (€) *</Label>
                  {isEditMode ? (
                    <Input
                      id="deposit"
                      type="number"
                      step="0.01"
                      {...form.register('deposit', { valueAsNumber: true })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{formatCurrency(item?.deposit || 0)}</p>
                  )}
                  {form.formState.errors.deposit && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.deposit.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="copies">Anzahl *</Label>
                  {isEditMode ? (
                    <Input
                      id="copies"
                      type="number"
                      {...form.register('copies', { valueAsNumber: true })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{item?.copies || 0}</p>
                  )}
                  {form.formState.errors.copies && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.copies.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="status">Status *</Label>
                  {isEditMode ? (
                    <select
                      id="status"
                      {...form.register('status')}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="instock">Auf Lager</option>
                      <option value="outofstock">Ausgeliehen</option>
                      <option value="reserved">Reserviert</option>
                      <option value="onbackorder">Nachbestellt</option>
                      <option value="lost">Verloren</option>
                      <option value="repairing">Reparatur</option>
                      <option value="forsale">Zu verkaufen</option>
                      <option value="deleted">Gelöscht</option>
                    </select>
                  ) : (
                    <div className="mt-1">{getStatusBadge((item?.status || 'instock') as ItemStatus)}</div>
                  )}
                </div>
              </div>
            </section>

            {/* Details */}
            <section>
              <h3 className="font-semibold text-lg mb-4">Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="synonyms">Synonyme</Label>
                  {isEditMode ? (
                    <Input
                      id="synonyms"
                      {...form.register('synonyms')}
                      className="mt-1"
                      placeholder="Komma-getrennt"
                    />
                  ) : (
                    <p className="mt-1 text-sm">
                      {item?.synonyms && item.synonyms.length > 0
                        ? item.synonyms.join(', ')
                        : '—'}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="packaging">Verpackung</Label>
                  {isEditMode ? (
                    <Textarea
                      id="packaging"
                      {...form.register('packaging')}
                      className="mt-1"
                      rows={2}
                    />
                  ) : (
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {item?.packaging || '—'}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="manual">Anleitung</Label>
                  {isEditMode ? (
                    <Textarea
                      id="manual"
                      {...form.register('manual')}
                      className="mt-1"
                      rows={2}
                    />
                  ) : (
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {item?.manual || '—'}
                    </p>
                  )}
                </div>

                <div className="col-span-2">
                  <Label htmlFor="parts">Teile</Label>
                  {isEditMode ? (
                    <Textarea
                      id="parts"
                      {...form.register('parts')}
                      className="mt-1"
                      rows={2}
                    />
                  ) : (
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {item?.parts || '—'}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Additional Information */}
            <section>
              <h3 className="font-semibold text-lg mb-4">Zusätzliche Informationen</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="added_on">Hinzugefügt am</Label>
                  {isEditMode ? (
                    <Input
                      id="added_on"
                      type="date"
                      {...form.register('added_on')}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">
                      {item ? formatDate(item.added_on) : '—'}
                    </p>
                  )}
                </div>

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
                      {getHighlightColorBadge(item?.highlight_color) || <span className="text-sm">—</span>}
                    </div>
                  )}
                </div>

                <div className="col-span-2">
                  <Label htmlFor="internal_note">Interne Notiz</Label>
                  {isEditMode ? (
                    <Textarea
                      id="internal_note"
                      {...form.register('internal_note')}
                      className="mt-1"
                      rows={3}
                    />
                  ) : (
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {item?.internal_note || '—'}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Rental History */}
            {!isNewItem && (
              <section>
                <h3 className="font-semibold text-lg mb-4">Leihverlauf</h3>
                {isLoadingHistory ? (
                  <div className="flex justify-center py-4">
                    <div className="h-6 w-6 animate-spin border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : rentals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Leihvorgänge</p>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left">Kunde</th>
                          <th className="px-3 py-2 text-left">Ausgeliehen</th>
                          <th className="px-3 py-2 text-left">Erwartet</th>
                          <th className="px-3 py-2 text-left">Zurückgegeben</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rentals.map((rental) => {
                          const status = calculateRentalStatus(
                            rental.rented_on,
                            rental.returned_on,
                            rental.expected_on,
                            rental.extended_on
                          );
                          return (
                            <tr key={rental.id} className="border-t">
                              <td className="px-3 py-2">
                                {rental.expand?.customer
                                  ? `${rental.expand.customer.firstname} ${rental.expand.customer.lastname}`
                                  : '—'}
                              </td>
                              <td className="px-3 py-2">{formatDate(rental.rented_on)}</td>
                              <td className="px-3 py-2">{formatDate(rental.expected_on)}</td>
                              <td className="px-3 py-2">
                                {rental.returned_on ? formatDate(rental.returned_on) : '—'}
                              </td>
                              <td className="px-3 py-2">
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
