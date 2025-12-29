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
import { PencilIcon, SaveIcon, XIcon, ImageIcon, Trash2Icon, UploadIcon, PlusCircleIcon, Tag } from 'lucide-react';
import Link from 'next/link';
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
import { formatDate, formatCurrency, calculateRentalStatus, dateToLocalString, localStringToDate } from '@/lib/utils/formatting';
import type { Item, ItemFormData, RentalExpanded, ItemCategory, ItemStatus, HighlightColor } from '@/types';
import { CATEGORY_OPTIONS, GERMAN_CATEGORY_VALUES } from '@/lib/constants/categories';
import { RentalDetailSheet } from './rental-detail-sheet';
import { FormHelpPanel } from './form-help-panel';
import { DOCUMENTATION } from '@/lib/constants/documentation';
import { useHelpCollapsed } from '@/hooks/use-help-collapsed';

// Validation schema (using German category names as they are stored in PocketBase)
const itemSchema = z.object({
  iid: z.number().int().min(1, 'ID muss mindestens 1 sein'),
  name: z.string().min(1, 'Name ist erforderlich'),
  brand: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
  category: z.array(z.enum(['Küche', 'Haushalt', 'Garten', 'Kinder', 'Freizeit', 'Heimwerken', 'Sonstige'])),
  deposit: z.number().min(0, 'Kaution muss positiv sein'),
  synonyms: z.string().optional(), // Comma-separated
  packaging: z.string().optional(),
  manual: z.string().optional(),
  parts: z.number().int().min(0, 'Teile muss positiv sein').optional(),
  copies: z.number().int().min(1, 'Anzahl muss mindestens 1 sein'),
  status: z.enum(['instock', 'outofstock', 'reserved', 'onbackorder', 'lost', 'repairing', 'forsale', 'deleted']),
  highlight_color: z.enum(['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', '']).optional(),
  internal_note: z.string().optional(),
  added_on: z.string(),
  msrp: z.number().min(0, 'UVP muss positiv sein').optional(),
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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

  // Help panel state (persisted in localStorage with 12h TTL)
  const { isCollapsed: isHelpCollapsed, toggle: toggleHelp } = useHelpCollapsed();

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      iid: 1,
      name: '',
      brand: '',
      model: '',
      description: '',
      category: [],
      deposit: 0,
      synonyms: '',
      packaging: '',
      manual: '',
      parts: undefined,
      copies: 1,
      status: 'instock',
      highlight_color: '',
      internal_note: '',
      added_on: dateToLocalString(new Date()),
      msrp: undefined,
    },
  });

  const { formState: { isDirty } } = form;

  // Load item data when item changes
  useEffect(() => {
    if (item) {
      form.reset({
        iid: item.iid,
        name: item.name,
        brand: item.brand || '',
        model: item.model || '',
        description: item.description || '',
        category: item.category as any, // Database stores German strings, not enum values
        deposit: item.deposit,
        synonyms: Array.isArray(item.synonyms) ? item.synonyms.join(', ') : '',
        packaging: item.packaging || '',
        manual: item.manual || '',
        parts: typeof item.parts === 'number' ? item.parts : undefined,
        copies: item.copies,
        status: item.status,
        highlight_color: (item.highlight_color || '') as '' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink',
        internal_note: item.internal_note || '',
        // Extract just the date part (YYYY-MM-DD) from PocketBase format (YYYY-MM-DD HH:MM:SS.000Z)
        added_on: item.added_on.split(' ')[0],
        msrp: item.msrp,
      });
      // Load existing images
      setExistingImages(item.images || []);
      setNewImages([]);
      setImagesToDelete([]);
      setIsEditMode(false);
    } else if (isNewItem) {
      // Fetch next available IID for new items
      const fetchNextIid = async () => {
        try {
          const lastItem = await collections.items().getFirstListItem<Item>('', { sort: '-iid' });
          const nextIid = (lastItem?.iid || 0) + 1;
          form.reset({
            iid: nextIid,
            name: '',
            brand: '',
            model: '',
            description: '',
            category: [],
            deposit: 0,
            synonyms: '',
            packaging: '',
            manual: '',
            parts: undefined,
            copies: 1,
            status: 'instock',
            highlight_color: '',
            internal_note: '',
            added_on: dateToLocalString(new Date()),
            msrp: undefined,
          });
        } catch (err) {
          // If no items exist yet, start with 1
          form.reset({
            iid: 1,
            name: '',
            brand: '',
            model: '',
            description: '',
            category: [],
            deposit: 0,
            synonyms: '',
            packaging: '',
            manual: '',
            parts: undefined,
            copies: 1,
            status: 'instock',
            highlight_color: '',
            internal_note: '',
            added_on: dateToLocalString(new Date()),
            msrp: undefined,
          });
        }
      };
      fetchNextIid();
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
      formData.append('iid', data.iid.toString());
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
      if (data.parts !== undefined) formData.append('parts', data.parts.toString());
      formData.append('copies', data.copies.toString());
      formData.append('status', data.status);
      if (data.highlight_color) formData.append('highlight_color', data.highlight_color);
      if (data.internal_note) formData.append('internal_note', data.internal_note);
      formData.append('added_on', data.added_on);
      if (data.msrp !== undefined) formData.append('msrp', data.msrp.toString());

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
        // Force reload after creating new item to ensure clean state
        onSave?.(savedItem);
        onOpenChange(false);
        window.location.reload();
      } else if (item) {
        savedItem = await collections.items().update<Item>(item.id, formData);
        toast.success('Artikel erfolgreich aktualisiert');
        onSave?.(savedItem);
        setIsEditMode(false);
        onOpenChange(false);
      } else {
        return;
      }
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

  const handleDelete = async () => {
    if (!item?.id) return;

    setIsLoading(true);
    try {
      await collections.items().delete(item.id);
      toast.success('Artikel erfolgreich gelöscht');
      setShowDeleteDialog(false);
      onSave?.(item);
      onOpenChange(false);
    } catch (err) {
      console.error('Error deleting item:', err);
      toast.error('Fehler beim Löschen des Artikels');
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
        <SheetContent
          className="w-full sm:max-w-4xl flex flex-col overflow-hidden"
          overlayContent={
            isEditMode ? (
              <FormHelpPanel
                content={DOCUMENTATION.itemForm}
                isCollapsed={isHelpCollapsed}
                onToggle={toggleHelp}
              />
            ) : undefined
          }
        >
          <SheetHeader className="border-b pb-6 mb-6 px-6 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {!isNewItem && (
                      <div className="inline-flex items-center gap-1.5 border-2 border-border rounded-md pr-1.5 font-mono text-3xl font-bold">
                        <span className="inline-flex items-center justify-center bg-red-500 text-white px-2.5 py-1 rounded-md">
                          {String(item?.iid).padStart(4, '0').substring(0, 2)}
                        </span>
                        <span className="text-foreground px-0.5">
                          {String(item?.iid).padStart(4, '0').substring(2, 4)}
                        </span>
                      </div>
                    )}
                    <SheetTitle className="text-2xl">
                      {isNewItem ? 'Neuer Artikel' : item?.name}
                    </SheetTitle>
                  </div>
                  {!isNewItem && item && (
                    <div className="text-2xl shrink-0">
                      {getStatusBadge(item.status)}
                    </div>
                  )}
                </div>
                {!isNewItem && item && item.highlight_color && (
                  <div className="flex items-center gap-3 mb-2">
                    {getHighlightColorBadge(item.highlight_color)}
                    <span>{item.internal_note || ''}</span>
                  </div>
                )}
                {!isNewItem && item && (
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    {item.brand && <span>{item.brand}</span>}
                    {item.brand && item.model && <span>•</span>}
                    {item.model && <span>{item.model}</span>}
                  </div>
                )}
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
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

          {isEditMode ? (
            /* Edit Mode - Traditional Form */
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-8 px-6">
              {/* Basic Information */}
              <section className="space-y-4">
                <div className="border-b pb-2 mb-4">
                  <h3 className="font-semibold text-lg">Basisdaten</h3>
                </div>
                <div className="space-y-4">
                  {/* ID on its own line */}
                  <div>
                    <Label htmlFor="iid">ID *</Label>
                    <Input
                      id="iid"
                      type="number"
                      {...form.register('iid', { valueAsNumber: true })}
                      className="mt-1"
                    />
                    {form.formState.errors.iid && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.iid.message}
                      </p>
                    )}
                  </div>

                  {/* Name on its own line */}
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      {...form.register('name')}
                      className="mt-1"
                    />
                    {form.formState.errors.name && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  {/* Brand and Model together */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="brand">Marke</Label>
                      <Input
                        id="brand"
                        {...form.register('brand')}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="model">Modell</Label>
                      <Input
                        id="model"
                        {...form.register('model')}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Description on its own line */}
                  <div>
                    <Label htmlFor="description">Beschreibung</Label>
                    <Textarea
                      id="description"
                      {...form.register('description')}
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Kategorien *</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {CATEGORY_OPTIONS.map(({ value, label }) => {
                        const isChecked = form.watch('category').includes(value as any);
                        return (
                          <label
                            key={value}
                            className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-muted/50 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const currentCategories = form.getValues('category');
                                if (e.target.checked) {
                                  form.setValue('category', [...currentCategories, value as any], { shouldDirty: true });
                                } else {
                                  form.setValue('category', currentCategories.filter(c => c !== value), { shouldDirty: true });
                                }
                              }}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {form.formState.errors.category && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.category.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="deposit">Kaution (€) *</Label>
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

                    <div>
                      <Label htmlFor="msrp">UVP (€)</Label>
                      <Input
                        id="msrp"
                        type="number"
                        step="0.01"
                        {...form.register('msrp', { valueAsNumber: true })}
                        className="mt-1"
                      />
                      {form.formState.errors.msrp && (
                        <p className="text-sm text-destructive mt-1">
                          {form.formState.errors.msrp.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="copies">Anzahl *</Label>
                      <Input
                        id="copies"
                        type="number"
                        {...form.register('copies', { valueAsNumber: true })}
                        className="mt-1"
                      />
                      {form.formState.errors.copies && (
                        <p className="text-sm text-destructive mt-1">
                          {form.formState.errors.copies.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="parts">Teile</Label>
                      <Input
                        id="parts"
                        type="number"
                        {...form.register('parts', { valueAsNumber: true })}
                        className="mt-1"
                      />
                      {form.formState.errors.parts && (
                        <p className="text-sm text-destructive mt-1">
                          {form.formState.errors.parts.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="status">Status *</Label>
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
                            src={pb.files.getURL(item!, imageName, { thumb: '512x512f' })}
                            alt={item?.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                            width={200}
                            height={200}
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

                <div className="col-span-2">
                  <Label className="mb-2 block">Markierungsfarbe</Label>
                  {isEditMode ? (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => form.setValue('highlight_color', '')}
                        className={`w-10 h-10 rounded-md border-2 transition-all bg-muted hover:bg-muted/80 flex items-center justify-center ${
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
                        className={`w-10 h-10 rounded-md border-2 transition-all bg-red-100 dark:bg-red-950/30 ${
                          form.watch('highlight_color') === 'red'
                            ? 'border-red-500 ring-2 ring-red-500/20 scale-105'
                            : 'border-red-300 dark:border-red-800 hover:border-red-500'
                        }`}
                        title="Rot"
                      />
                      <button
                        type="button"
                        onClick={() => form.setValue('highlight_color', 'orange')}
                        className={`w-10 h-10 rounded-md border-2 transition-all bg-orange-100 dark:bg-orange-950/30 ${
                          form.watch('highlight_color') === 'orange'
                            ? 'border-orange-500 ring-2 ring-orange-500/20 scale-105'
                            : 'border-orange-300 dark:border-orange-800 hover:border-orange-500'
                        }`}
                        title="Orange"
                      />
                      <button
                        type="button"
                        onClick={() => form.setValue('highlight_color', 'yellow')}
                        className={`w-10 h-10 rounded-md border-2 transition-all bg-yellow-100 dark:bg-yellow-950/30 ${
                          form.watch('highlight_color') === 'yellow'
                            ? 'border-yellow-500 ring-2 ring-yellow-500/20 scale-105'
                            : 'border-yellow-300 dark:border-yellow-800 hover:border-yellow-500'
                        }`}
                        title="Gelb"
                      />
                      <button
                        type="button"
                        onClick={() => form.setValue('highlight_color', 'green')}
                        className={`w-10 h-10 rounded-md border-2 transition-all bg-green-100 dark:bg-green-950/30 ${
                          form.watch('highlight_color') === 'green'
                            ? 'border-green-500 ring-2 ring-green-500/20 scale-105'
                            : 'border-green-300 dark:border-green-800 hover:border-green-500'
                        }`}
                        title="Grün"
                      />
                      <button
                        type="button"
                        onClick={() => form.setValue('highlight_color', 'teal')}
                        className={`w-10 h-10 rounded-md border-2 transition-all bg-teal-100 dark:bg-teal-950/30 ${
                          form.watch('highlight_color') === 'teal'
                            ? 'border-teal-500 ring-2 ring-teal-500/20 scale-105'
                            : 'border-teal-300 dark:border-teal-800 hover:border-teal-500'
                        }`}
                        title="Türkis"
                      />
                      <button
                        type="button"
                        onClick={() => form.setValue('highlight_color', 'blue')}
                        className={`w-10 h-10 rounded-md border-2 transition-all bg-blue-100 dark:bg-blue-950/30 ${
                          form.watch('highlight_color') === 'blue'
                            ? 'border-blue-500 ring-2 ring-blue-500/20 scale-105'
                            : 'border-blue-300 dark:border-blue-800 hover:border-blue-500'
                        }`}
                        title="Blau"
                      />
                      <button
                        type="button"
                        onClick={() => form.setValue('highlight_color', 'purple')}
                        className={`w-10 h-10 rounded-md border-2 transition-all bg-purple-100 dark:bg-purple-950/30 ${
                          form.watch('highlight_color') === 'purple'
                            ? 'border-purple-500 ring-2 ring-purple-500/20 scale-105'
                            : 'border-purple-300 dark:border-purple-800 hover:border-purple-500'
                        }`}
                        title="Lila"
                      />
                      <button
                        type="button"
                        onClick={() => form.setValue('highlight_color', 'pink')}
                        className={`w-10 h-10 rounded-md border-2 transition-all bg-pink-100 dark:bg-pink-950/30 ${
                          form.watch('highlight_color') === 'pink'
                            ? 'border-pink-500 ring-2 ring-pink-500/20 scale-105'
                            : 'border-pink-300 dark:border-pink-800 hover:border-pink-500'
                        }`}
                        title="Rosa"
                      />
                    </div>
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
                          <th className="px-4 py-3 text-left font-semibold">Nutzer</th>
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
          ) : (
            /* View Mode - Card-Based Layout */
            <div className="space-y-6 px-6">
              {/* Description Card */}
              {item?.description && (
                <section>
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Beschreibung
                    </div>
                    <p className="text-base whitespace-pre-wrap">{item.description}</p>
                  </div>
                </section>
              )}

              {/* Key Details Grid */}
              <section className="grid grid-cols-2 gap-4">
                {/* Categories */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Kategorien
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item?.category && item.category.length > 0 ? (
                      item.category.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-sm">
                          {cat}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-base text-muted-foreground">Keine</span>
                    )}
                  </div>
                </div>

                {/* Copies */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Anzahl Exemplare
                  </div>
                  <p className="text-2xl font-bold">{item?.copies || 0}</p>
                </div>

                {/* Parts */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Teile
                  </div>
                  <p className="text-2xl font-bold">{item?.parts ?? '—'}</p>
                </div>

                {/* Added Date */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Hinzugefügt am
                  </div>
                  <p className="text-base font-semibold">
                    {item ? formatDate(item.added_on) : '—'}
                  </p>
                </div>

                {/* MSRP */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    UVP
                  </div>
                  <p className="text-base font-semibold">
                    {item?.msrp && item.msrp > 0 ? `${item.msrp} €` : '—'}
                  </p>
                </div>

                {/* Synonyms */}
                {item?.synonyms && item.synonyms.length > 0 && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Synonyme
                    </div>
                    <p className="text-base">
                      {Array.isArray(item.synonyms) ? item.synonyms.join(', ') : item.synonyms}
                    </p>
                  </div>
                )}
              </section>

              {/* Additional Details */}
              {(item?.packaging || item?.manual || item?.internal_note) && (
                <section>
                  <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Weitere Details
                    </div>

                    {item?.packaging && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Verpackung
                        </div>
                        <p className="text-base whitespace-pre-wrap">{item.packaging}</p>
                      </div>
                    )}

                    {item?.manual && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Anleitung
                        </div>
                        <p className="text-base whitespace-pre-wrap">{item.manual}</p>
                      </div>
                    )}

                    {item?.internal_note && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Interne Notiz
                        </div>
                        <p className="text-base whitespace-pre-wrap">{item.internal_note}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Images */}
              {existingImages.length > 0 && (
                <section>
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Bilder
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {existingImages.map((imageName) => (
                      <div key={imageName} className="aspect-square rounded-lg border border-border overflow-hidden bg-muted">
                        <img
                          src={pb.files.getURL(item!, imageName, { thumb: '512x512f' })}
                          alt={item?.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                          width={200}
                          height={200}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Rental History */}
              {!isLoadingHistory && rentals.length > 0 && (
                <section>
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Ausleihhistorie
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3">
                            Nutzer
                          </th>
                          <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3">
                            Ausgeliehen
                          </th>
                          <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rentals.slice(0, 5).map((rental) => {
                          const status = calculateRentalStatus(
                            rental.rented_on,
                            rental.returned_on,
                            rental.expected_on,
                            rental.extended_on
                          );
                          return (
                            <tr key={rental.id} className="hover:bg-muted/30">
                              <td className="px-4 py-3 text-sm">
                                {rental.expand?.customer
                                  ? `${rental.expand.customer.firstname} ${rental.expand.customer.lastname}`
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {rental.rented_on ? formatDate(rental.rented_on) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={
                                    status === 'returned' || status === 'returned_today'
                                      ? 'secondary'
                                      : status === 'overdue'
                                      ? 'destructive'
                                      : 'default'
                                  }
                                >
                                  {status === 'active' && 'Aktiv'}
                                  {status === 'returned' && 'Zurückgegeben'}
                                  {status === 'overdue' && 'Überfällig'}
                                  {status === 'due_today' && 'Heute fällig'}
                                  {status === 'returned_today' && 'Heute zurück'}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {rentals.length > 5 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Zeige 5 von {rentals.length} Ausleihungen
                    </p>
                  )}
                </section>
              )}
            </div>
          )}
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
          ) : !isNewItem && (
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
                    asChild
                  >
                    <Link href={`/label-designer?itemId=${item?.id}`}>
                      <Tag className="size-4 mr-2" />
                      Etikett drucken
                    </Link>
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setIsRentalSheetOpen(true)}
                    disabled={item?.status !== 'instock'}
                    title={item?.status !== 'instock' ? 'Artikel ist nicht verfügbar' : 'Ausleihen'}
                  >
                    <PlusCircleIcon className="size-4 mr-2" />
                    Ausleihen
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
            <DialogTitle>Artikel löschen?</DialogTitle>
            <DialogDescription>
              Möchten Sie diesen Artikel wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
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
