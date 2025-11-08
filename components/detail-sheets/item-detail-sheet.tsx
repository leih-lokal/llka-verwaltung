/**
 * Item Detail Sheet Component
 * Displays and edits item information with rental history
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PencilIcon, SaveIcon, XIcon, ImageIcon, Trash2Icon, UploadIcon, PlusCircleIcon } from 'lucide-react';
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
import { collections, pb } from '@/lib/pocketbase/client';
import { formatDate, formatCurrency, calculateRentalStatus } from '@/lib/utils/formatting';
import type { Item, ItemFormData, RentalExpanded, ItemCategory, ItemStatus, HighlightColor } from '@/types';
import { CATEGORY_OPTIONS, GERMAN_CATEGORY_VALUES } from '@/lib/constants/categories';
import { RentalDetailSheet } from './rental-detail-sheet';

// Validation schema (using German category names as they are stored in PocketBase)
const itemSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  brand: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
  category: z.array(z.enum(['Küche', 'Haushalt', 'Garten', 'Kinder', 'Freizeit', 'Heimwerken', 'Sonstiges'])),
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

  // Rental sheet state
  const [isRentalSheetOpen, setIsRentalSheetOpen] = useState(false);

  // Image management
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        synonyms: Array.isArray(item.synonyms) ? item.synonyms.join(', ') : '',
        packaging: item.packaging || '',
        manual: item.manual || '',
        parts: item.parts || '',
        copies: item.copies,
        status: item.status,
        highlight_color: (item.highlight_color || '') as '' | 'green' | 'blue' | 'yellow' | 'red',
        internal_note: item.internal_note || '',
        added_on: item.added_on.split('T')[0],
      });
      // Load existing images
      setExistingImages(item.images || []);
      setNewImages([]);
      setImagesToDelete([]);
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
      setExistingImages([]);
      setNewImages([]);
      setImagesToDelete([]);
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

  // Image handling functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setNewImages((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const handleRemoveNewImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingImage = (imageName: string) => {
    setImagesToDelete((prev) => [...prev, imageName]);
    setExistingImages((prev) => prev.filter((img) => img !== imageName));
  };

  const handleSave = async (data: ItemFormValues) => {
    setIsLoading(true);
    try {
      // Build FormData for file upload support
      const formData = new FormData();

      // Add all text fields
      formData.append('name', data.name);
      if (data.brand) formData.append('brand', data.brand);
      if (data.model) formData.append('model', data.model);
      if (data.description) formData.append('description', data.description);

      // Add category array
      data.category.forEach(cat => formData.append('category', cat));

      formData.append('deposit', data.deposit.toString());

      // Add synonyms array
      const synonyms = data.synonyms ? data.synonyms.split(',').map(s => s.trim()).filter(Boolean) : [];
      synonyms.forEach(syn => formData.append('synonyms', syn));

      if (data.packaging) formData.append('packaging', data.packaging);
      if (data.manual) formData.append('manual', data.manual);
      if (data.parts) formData.append('parts', data.parts);
      formData.append('copies', data.copies.toString());
      formData.append('status', data.status);
      if (data.highlight_color) formData.append('highlight_color', data.highlight_color);
      if (data.internal_note) formData.append('internal_note', data.internal_note);
      formData.append('added_on', data.added_on);

      // Add new images
      newImages.forEach((file) => {
        formData.append('images', file);
      });

      // Mark images for deletion (PocketBase uses - prefix)
      imagesToDelete.forEach((imageName) => {
        formData.append('images-', imageName);
      });

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
          <SheetHeader className="border-b pb-6 mb-6 px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                  <SheetTitle className="text-2xl">
                    {isNewItem ? 'Neuer Artikel' : item?.name}
                  </SheetTitle>
                  {!isNewItem && (
                    <span className="font-mono text-lg text-primary font-semibold">
                      #{String(item?.iid).padStart(4, '0')}
                    </span>
                  )}
                  {!isNewItem && item && getStatusBadge(item.status)}
                  {!isNewItem && item && item.highlight_color && getHighlightColorBadge(item.highlight_color)}
                </div>
                {!isNewItem && item && (
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    {item.brand && <span>{item.brand}</span>}
                    {item.brand && item.model && <span>•</span>}
                    {item.model && <span>{item.model}</span>}
                  </div>
                )}
              </div>
              {!isNewItem && !isEditMode && (
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsRentalSheetOpen(true)}
                    disabled={item?.status !== 'instock'}
                    title={item?.status !== 'instock' ? 'Artikel ist nicht verfügbar' : 'Ausleihen'}
                  >
                    <PlusCircleIcon className="size-4 mr-2" />
                    Ausleihen
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditMode(true)}
                  >
                    <PencilIcon className="size-4 mr-2" />
                    Bearbeiten
                  </Button>
                </div>
              )}
            </div>
          </SheetHeader>

          {/* Quick Stats */}
          {!isNewItem && !isEditMode && (
            <div className="grid grid-cols-3 gap-4 mb-6 px-6">
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="text-sm font-medium text-muted-foreground mb-1">Ausleihungen</div>
                <div className="text-2xl font-bold">
                  {rentals.length}
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="text-sm font-medium text-muted-foreground mb-1">Aktuell ausgeliehen</div>
                <div className="text-2xl font-bold">
                  {rentals.filter(r => !r.returned_on).length}
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="text-sm font-medium text-muted-foreground mb-1">Kaution</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(item?.deposit || 0)}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-8 px-6">
            {/* Basic Information */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Basisdaten</h3>
              </div>
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
                      {CATEGORY_OPTIONS.map(({ value, label }) => (
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
                            {cat}
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

            {/* Images */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Bilder</h3>
              </div>

              {/* Display existing and new images */}
              <div className="space-y-4">
                {existingImages.length > 0 || newImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {/* Existing images */}
                    {existingImages.map((imageName) => (
                      <div key={imageName} className="relative group">
                        <div className="aspect-square rounded-lg border border-border overflow-hidden bg-muted">
                          <img
                            src={pb.files.getUrl(item!, imageName, { thumb: '200x200' })}
                            alt={item?.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {isEditMode && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingImage(imageName)}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Bild entfernen"
                          >
                            <Trash2Icon className="size-4" />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* New images (preview) */}
                    {newImages.map((file, index) => (
                      <div key={`new-${index}`} className="relative group">
                        <div className="aspect-square rounded-lg border border-border overflow-hidden bg-muted">
                          <img
                            src={URL.createObjectURL(file)}
                            alt="New upload"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {isEditMode && (
                          <button
                            type="button"
                            onClick={() => handleRemoveNewImage(index)}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Bild entfernen"
                          >
                            <Trash2Icon className="size-4" />
                          </button>
                        )}
                        <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-medium">
                          Neu
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-border rounded-lg bg-muted/20">
                    <ImageIcon className="size-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Keine Bilder</p>
                  </div>
                )}

                {/* Upload button (only in edit mode) */}
                {isEditMode && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <UploadIcon className="size-4 mr-2" />
                      Bilder hochladen
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Sie können mehrere Bilder gleichzeitig auswählen
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Details */}
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Details</h3>
              </div>
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
                        ? (Array.isArray(item.synonyms) ? item.synonyms.join(', ') : item.synonyms)
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
            <section className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <h3 className="font-semibold text-lg">Zusätzliche Informationen</h3>
              </div>
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
                          <th className="px-4 py-3 text-left font-semibold">Kunde</th>
                          <th className="px-4 py-3 text-left font-semibold">Ausgeliehen</th>
                          <th className="px-4 py-3 text-left font-semibold">Erwartet</th>
                          <th className="px-4 py-3 text-left font-semibold">Zurückgegeben</th>
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
                              <td className="px-4 py-3 font-medium">
                                {rental.expand?.customer
                                  ? `${rental.expand.customer.firstname} ${rental.expand.customer.lastname}`
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{formatDate(rental.rented_on)}</td>
                              <td className="px-4 py-3 text-muted-foreground">{formatDate(rental.expected_on)}</td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {rental.returned_on ? formatDate(rental.returned_on) : '—'}
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
            <SheetFooter className="border-t pt-4 px-6">
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

      {/* Rental Detail Sheet for creating new rental with this item */}
      {!isNewItem && item && (
        <RentalDetailSheet
          rental={null}
          open={isRentalSheetOpen}
          onOpenChange={setIsRentalSheetOpen}
          preloadedItems={[item]}
          onSave={(newRental) => {
            setIsRentalSheetOpen(false);
            // Optionally refresh rental history
            toast.success('Ausleihe erfolgreich erstellt');
          }}
        />
      )}
    </>
  );
}
