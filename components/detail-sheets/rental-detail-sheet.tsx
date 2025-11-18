/**
 * Rental Detail Sheet Component
 * Displays and edits rental information
 * Based on the old Svelte version's patterns
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { SaveIcon, XIcon, CheckIcon, ChevronsUpDownIcon, CalendarIcon, TrashIcon, MinusIcon, PlusIcon, PrinterIcon } from 'lucide-react';
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
import { formatDate, formatCurrency, calculateRentalStatus, dateToLocalString, localStringToDate } from '@/lib/utils/formatting';
import { cn } from '@/lib/utils';
import { useIdentity } from '@/hooks/use-identity';
import type { Rental, RentalExpanded, Customer, Item } from '@/types';
import { getCopyCount, setCopyCount, removeCopyCount, type InstanceData } from '@/lib/utils/instance-data';
import { getMultipleItemAvailability, type ItemAvailability } from '@/lib/utils/item-availability';

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
  return dateToLocalString(date);
}

function stringToDate(dateString: string | undefined): Date | undefined {
  if (!dateString) return undefined;
  try {
    const date = localStringToDate(dateString);
    return isValidDate(date) ? date : undefined;
  } catch {
    return undefined;
  }
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
  const { currentIdentity } = useIdentity();
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Track if preloaded items have been applied to prevent re-applying on every render
  const preloadedItemsAppliedRef = useRef(false);

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

  // Instance data state (copy counts for each item)
  const [instanceData, setInstanceData] = useState<InstanceData>({});
  const [itemAvailability, setItemAvailability] = useState<Map<string, ItemAvailability>>(new Map());

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
      rented_on: dateToLocalString(new Date()),
      returned_on: '',
      expected_on: dateToLocalString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
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

        // Load instance data from requested_copies field
        setInstanceData(rental.requested_copies || {});
      }

      // Set form values - handle both 'T' and space separators in date strings
      const parseDate = (dateStr: string | undefined) => {
        if (!dateStr) return '';
        // Handle both ISO format (2022-11-10T00:00:00) and space format (2022-11-10 00:00:00)
        return dateStr.split(/[T\s]/)[0];
      };

      const rentedOnValue = parseDate(rental.rented_on) || dateToLocalString(new Date());
      const returnedOnValue = parseDate(rental.returned_on);
      const expectedOnValue = parseDate(rental.expected_on) || dateToLocalString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
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
        remark: rental.remark || '', // User notes are now separate from instance data
        employee: rental.employee || '',
        employee_back: rental.employee_back || '',
      });

      // Reset the preloaded items flag when viewing existing rental
      preloadedItemsAppliedRef.current = false;
    } else if (isNewRental && open) {
      // Only apply preloaded items once when modal first opens
      if (!preloadedItemsAppliedRef.current) {
        // Reset for new rental
        setSelectedCustomer(null);
        setInstanceData({}); // Reset instance data for new rental

        // Use preloaded items if provided
        const itemsToUse = preloadedItems.length > 0 ? preloadedItems : [];
        setSelectedItems(itemsToUse);

        // Initialize instance data with 1 copy for each preloaded item
        const initialInstanceData: InstanceData = {};
        itemsToUse.forEach(item => {
          initialInstanceData[item.id] = 1;
        });
        setInstanceData(initialInstanceData);

        // Calculate total deposit from preloaded items
        const totalDeposit = itemsToUse.reduce((sum, item) => sum + (item.deposit || 0), 0);

        const defaultRentedOn = dateToLocalString(new Date());
        const defaultExpectedOn = dateToLocalString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

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

        // Mark preloaded items as applied
        preloadedItemsAppliedRef.current = true;
      }
    } else if (!open) {
      // Reset flag when modal closes
      preloadedItemsAppliedRef.current = false;
    }
  }, [rental, isNewRental, form, open, setValue]);

  // Auto-fill employee field from identity when creating new rental
  useEffect(() => {
    if (isNewRental && open && currentIdentity) {
      // Only auto-fill if the field is empty
      const currentEmployee = form.getValues('employee');
      if (!currentEmployee || currentEmployee.trim() === '') {
        setValue('employee', currentIdentity, { shouldDirty: false });
      }
    } else if (isNewRental && open && !currentIdentity) {
      // Show warning if no identity is set
      const timer = setTimeout(() => {
        toast.warning('Bitte wählen Sie Ihre Identität in der Navigationsleiste');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isNewRental, open, currentIdentity, form, setValue]);

  // Fetch item availability when selected items change
  useEffect(() => {
    if (selectedItems.length === 0) {
      setItemAvailability(new Map());
      return;
    }

    const fetchAvailability = async () => {
      const itemIds = selectedItems.map(item => item.id);
      const availabilityMap = await getMultipleItemAvailability(
        itemIds,
        rental?.id // Exclude current rental when editing
      );
      setItemAvailability(availabilityMap);
    };

    fetchAvailability();
  }, [selectedItems, rental?.id]);

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

        // Only show items that are available (instock) or reserved
        const filter = `(${filters.join(' || ')}) && (status='instock' || status='reserved')`;

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

    // Initialize instance data with 1 copy for the new item
    const newInstanceData = setCopyCount(instanceData, item.id, 1);
    setInstanceData(newInstanceData);

    // Auto-calculate total deposit from all items with copy counts
    const totalDeposit = newSelectedItems.reduce((sum, i) => {
      const copies = getCopyCount(newInstanceData, i.id);
      return sum + ((i.deposit || 0) * copies);
    }, 0);
    setValue('deposit', totalDeposit, { shouldDirty: true });

    setItemSearchOpen(false);
    setItemSearch('');
    showItemNotifications(item);
  };

  const handleItemRemove = (itemId: string) => {
    const newSelectedItems = selectedItems.filter(i => i.id !== itemId);
    setSelectedItems(newSelectedItems);
    setValue('item_iids', newSelectedItems.map(i => i.iid), { shouldDirty: true });

    // Remove from instance data
    const newInstanceData = removeCopyCount(instanceData, itemId);
    setInstanceData(newInstanceData);

    // Recalculate deposit with copy counts
    const totalDeposit = newSelectedItems.reduce((sum, i) => {
      const copies = getCopyCount(newInstanceData, i.id);
      return sum + ((i.deposit || 0) * copies);
    }, 0);
    setValue('deposit', totalDeposit, { shouldDirty: true });
  };

  const handleCopyCountChange = (itemId: string, newCount: number) => {
    const item = selectedItems.find(i => i.id === itemId);
    if (!item) return;

    // Validate against available copies
    const availability = itemAvailability.get(itemId);
    if (availability && newCount > availability.availableCopies) {
      toast.error(`Nur ${availability.availableCopies} von ${availability.totalCopies} Exemplaren verfügbar`);
      return;
    }

    // Update instance data
    const newInstanceData = setCopyCount(instanceData, itemId, newCount);
    setInstanceData(newInstanceData);

    // Recalculate deposit
    const totalDeposit = selectedItems.reduce((sum, i) => {
      const copies = getCopyCount(newInstanceData, i.id);
      return sum + ((i.deposit || 0) * copies);
    }, 0);
    setValue('deposit', totalDeposit, { shouldDirty: true });
  };

  const handleSave = async (data: RentalFormValues) => {
    setIsLoading(true);
    try {
      // Get customer by iid to get its PocketBase ID
      const customer = await collections.customers().getFirstListItem<Customer>(`iid=${data.customer_iid}`);

      // Get all items by iid to get their PocketBase IDs and validate their status
      const items = await Promise.all(
        data.item_iids.map(async (iid) => {
          const item = await collections.items().getFirstListItem<Item>(`iid=${iid}`);
          return item;
        })
      );

      // Validate that all items are available (instock or reserved)
      // Skip this check if we're returning a rental (returned_on is set)
      // Also skip this check when editing an existing rental (the copy availability check below handles it)
      const isReturning = !!data.returned_on;

      if (!isReturning && isNewRental) {
        const unavailableItems = items.filter(item =>
          item.status !== 'instock' && item.status !== 'reserved'
        );

        if (unavailableItems.length > 0) {
          const itemNames = unavailableItems.map(item =>
            `${item.name} (#${String(item.iid).padStart(4, '0')})`
          ).join(', ');
          toast.error(`Folgende Gegenstände sind nicht verfügbar: ${itemNames}`);
          setIsLoading(false);
          return;
        }

        // Validate copy counts against availability
        for (const item of items) {
          const requestedCopies = getCopyCount(instanceData, item.id);
          const availability = itemAvailability.get(item.id);

          if (availability && requestedCopies > availability.availableCopies) {
            toast.error(
              `${item.name} (#${String(item.iid).padStart(4, '0')}): Nur ${availability.availableCopies} von ${availability.totalCopies} Exemplaren verfügbar`
            );
            setIsLoading(false);
            return;
          }
        }
      }

      const itemIds = items.map(item => item.id);

      const formData: Partial<Rental> = {
        customer: customer.id,
        items: itemIds, // Multiple items per rental
        requested_copies: instanceData, // Store copy counts in JSON field
        deposit: data.deposit,
        deposit_back: data.deposit_back,
        rented_on: data.rented_on,
        returned_on: data.returned_on || undefined,
        expected_on: data.expected_on,
        extended_on: data.extended_on || undefined,
        remark: data.remark || undefined, // User notes, no instance data
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
      setValue('returned_on', dateToLocalString(new Date()), { shouldDirty: true });
    }

    // Set deposit_back to deposit if not set
    if (data.deposit_back === 0 && data.deposit > 0) {
      setValue('deposit_back', data.deposit, { shouldDirty: true });
    }

    // Auto-fill employee_back from current identity if not set
    if (!data.employee_back || data.employee_back.trim() === '') {
      if (currentIdentity) {
        setValue('employee_back', currentIdentity, { shouldDirty: true });
      } else {
        toast.warning('Bitte wählen Sie Ihre Identität in der Navigationsleiste');
      }
    }

    // Submit the form
    form.handleSubmit(handleSave)();
  };

  const handlePrint = () => {
    if (!rental || !selectedCustomer) return;

    // Format date for display
    const formatPrintDate = (dateStr: string | undefined) => {
      if (!dateStr) return '-';
      try {
        const date = localStringToDate(dateStr.split(/[T\s]/)[0]);
        return date.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
      } catch {
        return dateStr;
      }
    };

    // Calculate total copies
    const totalCopies = selectedItems.reduce((sum, item) => {
      return sum + getCopyCount(instanceData, item.id);
    }, 0);

    // Generate items HTML
    const itemsHtml = selectedItems.map((item) => {
      const copyCount = getCopyCount(instanceData, item.id);
      const depositPerCopy = item.deposit || 0;
      const totalDeposit = depositPerCopy * copyCount;
      const hasCopies = copyCount > 1;

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; font-family: monospace; font-weight: 600; color: #0066cc;">
            #${String(item.iid).padStart(4, '0')}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5;">
            <strong>${item.name}</strong>
            ${item.brand ? `<br><span style="color: #666; font-size: 0.9em;">Marke: ${item.brand}</span>` : ''}
            ${item.model ? `<br><span style="color: #666; font-size: 0.9em;">Modell: ${item.model}</span>` : ''}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: center;">
            ${copyCount}${hasCopies ? ' Stück' : ''}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 600;">
            ${formatCurrency(totalDeposit)}
          </td>
        </tr>
      `;
    }).join('');

    const printContent = `
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <title>Leihbeleg - LeihLokal</title>
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            margin: 0 0 5px 0;
            color: #0066cc;
            font-size: 28px;
          }
          .header .subtitle {
            color: #666;
            font-size: 14px;
          }
          .section {
            margin-bottom: 25px;
          }
          .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #0066cc;
            border-bottom: 2px solid #e5e5e5;
            padding-bottom: 8px;
            margin-bottom: 15px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .info-item {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
          }
          .info-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
          }
          .info-value {
            font-weight: 600;
            font-size: 14px;
          }
          .customer-box {
            background: #f0f7ff;
            border: 1px solid #cce0ff;
            border-radius: 8px;
            padding: 15px;
          }
          .customer-id {
            font-family: monospace;
            font-weight: 600;
            color: #0066cc;
            font-size: 16px;
          }
          .customer-name {
            font-size: 18px;
            font-weight: 600;
            margin: 5px 0;
          }
          .customer-details {
            color: #666;
            font-size: 13px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background: #f8f9fa;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #e5e5e5;
          }
          th:last-child {
            text-align: right;
          }
          .total-row {
            background: #f0f7ff;
            font-weight: 600;
          }
          .total-row td {
            padding: 15px 12px;
            border-top: 2px solid #0066cc;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            text-align: center;
            color: #999;
            font-size: 12px;
          }
          .note-box {
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 6px;
            padding: 12px;
            margin-top: 10px;
          }
          .note-label {
            font-weight: 600;
            color: #92400e;
            margin-bottom: 5px;
          }
          @media print {
            body {
              padding: 0;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Leihbeleg</h1>
          <div class="subtitle">Kundenexemplar • LeihLokal</div>
        </div>

        <div class="section">
          <div class="section-title">Nutzer:in</div>
          <div class="customer-box">
            <div class="customer-id">#${String(selectedCustomer.iid).padStart(4, '0')}</div>
            <div class="customer-name">${selectedCustomer.firstname} ${selectedCustomer.lastname}</div>
            <div class="customer-details">
              ${selectedCustomer.email ? `${selectedCustomer.email}<br>` : ''}
              ${selectedCustomer.phone ? `Tel: ${selectedCustomer.phone}<br>` : ''}
              ${selectedCustomer.street ? `${selectedCustomer.street}, ${selectedCustomer.postal_code} ${selectedCustomer.city}` : ''}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Leihzeitraum</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Ausgeliehen am</div>
              <div class="info-value">${formatPrintDate(rental.rented_on)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Zurückerwartet am</div>
              <div class="info-value">${formatPrintDate(rental.expected_on)}</div>
            </div>
            ${rental.extended_on ? `
              <div class="info-item">
                <div class="info-label">Verlängert am</div>
                <div class="info-value">${formatPrintDate(rental.extended_on)}</div>
              </div>
            ` : ''}
            ${rental.returned_on ? `
              <div class="info-item">
                <div class="info-label">Zurückgegeben am</div>
                <div class="info-value">${formatPrintDate(rental.returned_on)}</div>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Ausgeliehene Gegenstände (${totalCopies} ${totalCopies === 1 ? 'Stück' : 'Stück'})</div>
          <table>
            <thead>
              <tr>
                <th style="width: 80px;">Nr.</th>
                <th>Bezeichnung</th>
                <th style="width: 80px; text-align: center;">Anzahl</th>
                <th style="width: 100px; text-align: right;">Pfand</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">Gesamt Pfand:</td>
                <td style="text-align: right; font-size: 16px;">${formatCurrency(form.getValues('deposit'))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${rental.remark ? `
          <div class="section">
            <div class="note-box">
              <div class="note-label">Bemerkung:</div>
              <div>${rental.remark}</div>
            </div>
          </div>
        ` : ''}

        <div class="section">
          <div class="section-title">Mitarbeiter</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Ausgabe</div>
              <div class="info-value">${rental.employee || '-'}</div>
            </div>
            ${rental.employee_back ? `
              <div class="info-item">
                <div class="info-label">Rücknahme</div>
                <div class="info-value">${rental.employee_back}</div>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="footer">
          <p>Gedruckt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p>Dies ist eine Kundenquittung und dient nur zur Information.</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      // Small delay to ensure content is loaded
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      toast.error('Druckfenster konnte nicht geöffnet werden. Bitte Popup-Blocker überprüfen.');
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
    setValue('rented_on', dateToLocalString(new Date()), { shouldDirty: true });
  };

  const setExpectedOn = (weeks: number) => {
    const date = new Date();
    date.setDate(date.getDate() + weeks * 7);
    setValue('expected_on', dateToLocalString(date), { shouldDirty: true });
  };

  const setReturnedOnToday = () => {
    setValue('returned_on', dateToLocalString(new Date()), { shouldDirty: true });
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
                  <>
                    <div className="flex gap-2 text-sm text-muted-foreground">
                      <span>Ausgeliehen: {formatDate(rental.rented_on)}</span>
                      <span>•</span>
                      <span>Erwartet: {formatDate(rental.expected_on)}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs font-mono text-muted-foreground/70">
                        ID: {rental.id}
                      </span>
                    </div>
                  </>
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
                            {selectedCustomer.phone && (
                              <p>
                                <a
                                  href={`tel:${selectedCustomer.phone.replace(/\s/g, '')}`}
                                  className="hover:underline font-mono text-base text-foreground"
                                  title="Zum Anrufen klicken"
                                >
                                  {selectedCustomer.phone.replace(/\s/g, '').match(/.{1,4}/g)?.join(' ') || selectedCustomer.phone}
                                </a>
                              </p>
                            )}
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
                      {selectedItems.map((item) => {
                        const copyCount = getCopyCount(instanceData, item.id);
                        const availability = itemAvailability.get(item.id);
                        const totalCopies = item.copies || 1;
                        const hasMultipleCopies = totalCopies > 1;
                        const depositPerCopy = item.deposit || 0;
                        const totalDeposit = depositPerCopy * copyCount;

                        return (
                          <div key={item.id} className="border rounded-lg p-3 bg-muted/50">
                            <div className="flex items-start justify-between gap-3">
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

                            {/* Copy count selector for items with multiple copies */}
                            {hasMultipleCopies && (
                              <div className="mt-3 pt-3 border-t flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <Label className="text-xs text-muted-foreground">Anzahl:</Label>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopyCountChange(item.id, Math.max(1, copyCount - 1))}
                                      disabled={copyCount <= 1}
                                      className="h-7 w-7 p-0"
                                      title="Weniger"
                                    >
                                      <MinusIcon className="h-3 w-3" />
                                    </Button>
                                    <span className="font-mono font-semibold text-sm w-8 text-center">
                                      {copyCount}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopyCountChange(item.id, copyCount + 1)}
                                      disabled={availability ? copyCount >= availability.availableCopies : false}
                                      className="h-7 w-7 p-0"
                                      title="Mehr"
                                    >
                                      <PlusIcon className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {availability
                                      ? `(${availability.availableCopies} von ${availability.totalCopies} verfügbar)`
                                      : `(${totalCopies} Exemplare)`
                                    }
                                  </span>
                                </div>
                                <div className="text-sm font-medium">
                                  {copyCount > 1 && (
                                    <span className="text-muted-foreground text-xs mr-2">
                                      {formatCurrency(depositPerCopy)} × {copyCount} =
                                    </span>
                                  )}
                                  <span className="text-foreground">
                                    {formatCurrency(totalDeposit)}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Single copy items just show deposit */}
                            {!hasMultipleCopies && (
                              <div className="mt-2 text-sm font-medium text-foreground">
                                {formatCurrency(depositPerCopy)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {selectedItems.length > 1 && (
                        <div className="pt-3 border-t-2 border-primary">
                          <div className="flex items-center justify-between bg-primary/10 rounded-lg p-4">
                            <span className="text-lg font-semibold text-primary">
                              Gesamt Pfand:
                            </span>
                            <span className="text-3xl font-bold text-primary">
                              {formatCurrency(selectedItems.reduce((sum, i) => {
                                const copies = getCopyCount(instanceData, i.id);
                                return sum + ((i.deposit || 0) * copies);
                              }, 0))}
                            </span>
                          </div>
                        </div>
                      )}
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
                    <Label htmlFor="extended_on">Verlängert am</Label>
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
                        onClick={() => setValue('extended_on', dateToLocalString(new Date()), { shouldDirty: true })}
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
                {!isNewRental && selectedCustomer && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrint}
                    disabled={isLoading}
                    size="lg"
                    className="min-w-[120px]"
                  >
                    <PrinterIcon className="size-5 mr-2" />
                    Drucken
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
