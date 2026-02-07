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
import { SaveIcon, XIcon, Grid2x2Check, CornerDownLeft, Blocks,  CheckIcon, ChevronsUpDownIcon, CalendarIcon, TrashIcon, MinusIcon, PlusIcon, PrinterIcon } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { collections } from '@/lib/pocketbase/client';
import { formatDate, formatCurrency, calculateRentalStatus, dateToLocalString, localStringToDate } from '@/lib/utils/formatting';
import { cn } from '@/lib/utils';
import { useIdentity } from '@/hooks/use-identity';
import type { Rental, RentalExpanded, Customer, Item } from '@/types';
import { getCopyCount, setCopyCount, removeCopyCount, type InstanceData } from '@/lib/utils/instance-data';
import { getMultipleItemAvailability, type ItemAvailability } from '@/lib/utils/item-availability';
import { getReturnedCopyCount, mergeReturnedItems } from '@/lib/utils/partial-returns';
import { generateRentalPrintContent } from '@/components/print/rental-print-content';
import { FormHelpPanel } from './form-help-panel';
import { DOCUMENTATION } from '@/lib/constants/documentation';
import { useHelpCollapsed } from '@/hooks/use-help-collapsed';
import { FormattedId } from '@/components/ui/formatted-id';

// Validation schema
const rentalSchema = z.object({
  customer_iid: z.number().min(1, 'Nutzer ist erforderlich'),
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
  sourceReservationId?: string;
  sourceBookingId?: string;
}

export function RentalDetailSheet({
  rental,
  open,
  onOpenChange,
  onSave,
  preloadedItems = [],
  sourceReservationId,
  sourceBookingId,
}: RentalDetailSheetProps) {
  const { currentIdentity } = useIdentity();
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { isCollapsed: isHelpCollapsed, toggle: toggleHelp } = useHelpCollapsed();

  // Partial return state
  const [showPartialReturnDialog, setShowPartialReturnDialog] = useState(false);
  const [itemsToReturn, setItemsToReturn] = useState<Record<string, number>>({});
  const [partialReturnDeposit, setPartialReturnDeposit] = useState(0);

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
        let sortBy = 'lastname,firstname';

        // If search is numeric, search by iid
        if (/^\d+$/.test(customerSearch)) {
          filters.push(`iid=${parseInt(customerSearch, 10)}`);
          sortBy = 'iid'; // Sort by iid when searching numerically
        } else {
          // Check if search contains a space (possible full name search)
          const trimmedSearch = customerSearch.trim();
          if (trimmedSearch.includes(' ')) {
            // Split into parts for full name search
            const parts = trimmedSearch.split(/\s+/);
            const firstName = parts[0];
            const lastName = parts.slice(1).join(' ');

            // Search for firstname AND lastname match
            filters.push(`(firstname~'${firstName}' && lastname~'${lastName}')`);
            // Also try reversed (lastname firstname)
            filters.push(`(firstname~'${lastName}' && lastname~'${firstName}')`);
          }

          // Always search individual fields
          filters.push(`firstname~'${trimmedSearch}'`);
          filters.push(`lastname~'${trimmedSearch}'`);
        }

        const filter = filters.join(' || ');

        const result = await collections.customers().getList<Customer>(1, 20, {
          filter,
          sort: sortBy,
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
          filters.push(`iid=${parseInt(itemSearch, 10)}`);
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
    setValue('item_iids', newSelectedItems.map(i => i.iid), {
      shouldDirty: true,
      shouldValidate: true
    });

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
    setValue('item_iids', newSelectedItems.map(i => i.iid), {
      shouldDirty: true,
      shouldValidate: true
    });

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

        // Mark source reservation as done after successful rental creation
        if (sourceReservationId) {
          try {
            await collections.reservations().update(sourceReservationId, { done: true });
          } catch (err) {
            console.error('Error marking reservation as complete:', err);
            toast.warning('Leihvorgang erstellt, aber Reservierung konnte nicht aktualisiert werden');
          }
        }

        // Mark source booking as active and link the rental
        if (sourceBookingId) {
          try {
            await collections.bookings().update(sourceBookingId, {
              status: 'active',
              associated_rental: savedRental.id,
            });
          } catch (err) {
            console.error('Error marking booking as active:', err);
            toast.warning('Leihvorgang erstellt, aber Buchung konnte nicht aktualisiert werden');
          }
        }
      } else if (rental) {
        savedRental = await collections.rentals().update<Rental>(rental.id, formData);
        toast.success('Leihvorgang erfolgreich aktualisiert');

        // If rental is now returned, mark associated booking as returned
        if (formData.returned_on) {
          try {
            const linked = await collections.bookings().getFullList({
              filter: `associated_rental="${rental.id}"`,
            });
            await Promise.all(
              linked.map((b) =>
                collections.bookings().update(b.id, { status: 'returned' })
              )
            );
          } catch {
            // Silently ignore — booking may not exist
          }
        }
      } else {
        return;
      }

      onSave?.(savedRental);
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving rental:', err);

      // Extract error message from PocketBase response
      let errorMessage = 'Fehler beim Speichern des Leihvorgangs';

      if (err && typeof err === 'object') {
        // PocketBase error with message property
        if ('message' in err && typeof err.message === 'string') {
          errorMessage = err.message;
        }
        // PocketBase ClientResponseError with data.message
        else if ('data' in err && err.data && typeof err.data === 'object' && 'message' in err.data) {
          errorMessage = String(err.data.message);
        }
        // Response body with message (for 400 errors)
        else if ('response' in err && err.response && typeof err.response === 'object') {
          const response = err.response as any;
          if (response.data && response.data.message) {
            errorMessage = response.data.message;
          }
        }
      }

      toast.error(errorMessage);
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
    if (isNewRental || !rental) return;

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

    // If there are partial returns, mark all remaining items as returned
    if (rental.returned_items && Object.keys(rental.returned_items).length > 0) {
      try {
        setIsLoading(true);

        // Create complete returned_items with all items fully returned
        const completeReturnedItems: Record<string, number> = {};
        for (const itemId of rental.items) {
          const requested = getCopyCount(rental.requested_copies, itemId);
          completeReturnedItems[itemId] = requested;
        }

        // Update the rental directly to complete all returns
        const updateData: Partial<Rental> = {
          returned_items: completeReturnedItems,
          returned_on: dateToLocalString(new Date()),
          deposit_back: data.deposit,
          employee_back: currentIdentity || data.employee_back,
        };

        const updatedRental = await collections.rentals().update<Rental>(
          rental.id,
          updateData
        );

        toast.success('Alle Gegenstände zurückgegeben');
        onSave?.(updatedRental);
        onOpenChange(false); // Close the sheet
        return;
      } catch (err) {
        console.error('Error completing return:', err);
        toast.error('Fehler beim Zurückgeben');
        return;
      } finally {
        setIsLoading(false);
      }
    }

    // Submit the form for normal returns (no partial returns)
    // The handleSave function will close the sheet on success
    form.handleSubmit(handleSave)();
  };

  const handlePartialReturn = async () => {
    if (!rental || isNewRental) return;

    try {
      setIsLoading(true);

      // Merge new returns with existing returns
      const mergedReturnedItems = mergeReturnedItems(
        rental.returned_items,
        itemsToReturn
      );

      // Check if this partial return completes the rental
      const isNowFullyReturned = rental.items.every((itemId) => {
        const requested = getCopyCount(rental.requested_copies, itemId);
        const returned = mergedReturnedItems[itemId] || 0;
        return requested === returned;
      });

      // Prepare update data
      const updateData: Partial<Rental> = {
        returned_items: mergedReturnedItems,
        deposit_back: rental.deposit_back + partialReturnDeposit,
        employee_back: currentIdentity || rental.employee_back,
      };

      // If fully returned now, set returned_on
      if (isNowFullyReturned) {
        updateData.returned_on = dateToLocalString(new Date());
      }

      const updatedRental = await collections.rentals().update<Rental>(
        rental.id,
        updateData
      );

      toast.success(
        isNowFullyReturned
          ? 'Alle Gegenstände zurückgegeben'
          : 'Teilrückgabe erfolgreich'
      );

      // Reset dialog
      setShowPartialReturnDialog(false);
      setItemsToReturn({});
      setPartialReturnDeposit(0);

      // Refresh
      onSave?.(updatedRental);
    } catch (err) {
      console.error('Error processing partial return:', err);
      toast.error('Fehler bei der Teilrückgabe');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    if (!rental || !selectedCustomer) return;

    const printContent = generateRentalPrintContent({
      rental,
      customer: selectedCustomer,
      items: selectedItems,
      instanceData,
      deposit: form.getValues('deposit'),
    });

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
        <SheetContent
          className="w-full sm:max-w-4xl flex flex-col overflow-hidden"
          overlayContent={
            <FormHelpPanel
              content={DOCUMENTATION.rentalForm}
              isCollapsed={isHelpCollapsed}
              onToggle={toggleHelp}
            />
          }
        >
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
                            placeholder="Nutzer:in suchen (Name, Nr)..."
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
                                    className="group"
                                  >
                                    <CheckIcon
                                      className={cn(
                                        "mr-2 h-4 w-4 group-aria-selected:text-white",
                                        selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span className="font-mono text-primary font-semibold mr-2 group-aria-selected:text-white">
                                      #{String(customer.iid).padStart(4, '0')}
                                    </span>
                                    <span className="group-aria-selected:text-white">{customer.firstname} {customer.lastname}</span>
                                    {customer.email && (
                                      <span className="ml-2 text-muted-foreground text-xs group-aria-selected:text-white">
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
                                    className="group"
                                  >
                                    <CheckIcon
                                      className={cn(
                                        "mr-2 h-4 w-4 group-aria-selected:text-white",
                                        selectedItems.some(i => i.id === item.id) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span className="mr-2">
                                      <FormattedId id={item.iid} size="md" />
                                    </span>
                                    <span className="flex-1 group-aria-selected:text-white">{item.name}</span>
                                    <span className="text-muted-foreground text-xs ml-2 group-aria-selected:text-white">
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
                        const returnedCount = !isNewRental ? getReturnedCopyCount(rental?.returned_items, item.id) : 0;
                        const remainingCount = copyCount - returnedCount;
                        const hasReturns = returnedCount > 0;
                        const isFullyReturned = returnedCount > 0 && returnedCount === copyCount;
                        const availability = itemAvailability.get(item.id);
                        const totalCopies = item.copies || 1;
                        const hasMultipleCopies = totalCopies > 1;
                        const depositPerCopy = item.deposit || 0;
                        const totalDeposit = depositPerCopy * copyCount;

                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "border rounded-lg p-3 bg-muted/50",
                              isFullyReturned && "opacity-60 bg-muted"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-1">
                                  <FormattedId id={item.iid} size="md" className="mr-2" />
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

                            {/* Return status badge */}
                            {hasReturns && (
                              <div className="mt-2 pt-2 border-t">
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  {returnedCount}/{copyCount} zurückgegeben
                                  {remainingCount > 0 && ` • ${remainingCount} noch aus`}
                                </Badge>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {selectedItems.length > 1 && (
                        <div className="pt-3 border-t-2 border-primary">
                          <div className="flex items-center justify-between bg-primary/10 rounded-lg p-4">
                            {(() => {
                              const totalDeposit = selectedItems.reduce((sum, i) => {
                                const copies = getCopyCount(instanceData, i.id);
                                return sum + ((i.deposit || 0) * copies);
                              }, 0);

                              const remainingDeposit = !isNewRental
                                ? selectedItems.reduce((sum, i) => {
                                    const copies = getCopyCount(instanceData, i.id);
                                    const returned = getReturnedCopyCount(rental?.returned_items, i.id);
                                    const stillOut = copies - returned;
                                    return sum + ((i.deposit || 0) * stillOut);
                                  }, 0)
                                : totalDeposit;

                              const hasPartialReturns = !isNewRental && totalDeposit !== remainingDeposit && remainingDeposit > 0;

                              return (
                                <>
                                  <span className="text-lg font-semibold text-primary">
                                    {hasPartialReturns ? (
                                      <>
                                        <span className="line-through opacity-60 mr-2">
                                          {formatCurrency(totalDeposit)}
                                        </span>
                                        Verbleibendes Pfand:
                                      </>
                                    ) : (
                                      'Gesamt Pfand:'
                                    )}
                                  </span>
                                  <span className="text-3xl font-bold text-primary">
                                    {formatCurrency(hasPartialReturns ? remainingDeposit : totalDeposit)}
                                  </span>
                                </>
                              );
                            })()}
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
                            startMonth={new Date(2020, 0)}
                            endMonth={new Date(2030, 11)}
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
                            startMonth={new Date(2020, 0)}
                            endMonth={new Date(2030, 11)}
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
                              startMonth={new Date(2020, 0)}
                              endMonth={new Date(2030, 11)}
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
                              startMonth={new Date(2020, 0)}
                              endMonth={new Date(2030, 11)}
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
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                  size="lg"
                  className="w-10 h-10 p-0"
                  title="Abbrechen"
                >
                  <XIcon className="size-5" />
                </Button>
                {!isNewRental && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isLoading}
                    size="lg"
                    className="w-10 h-10 p-0"
                    title="Löschen"
                  >
                    <TrashIcon className="size-5" />
                  </Button>
                )}
                {!isNewRental && selectedCustomer && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrint}
                    disabled={isLoading}
                    size="lg"
                    className="w-10 h-10 p-0"
                    title="Drucken"
                  >
                    <PrinterIcon className="size-5" />
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                {!isNewRental && !returnedOn && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-w-[140px] border-green-600 text-green-600 hover:bg-green-50"
                      onClick={() => setShowPartialReturnDialog(true)}
                      disabled={isLoading}
                      size="lg"
                    >
                      <Blocks className="size-5 mr-2" />
                      Teilrückgabe
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700 min-w-[140px]"
                      onClick={handleReturn}
                      disabled={isLoading}
                      size="lg"
                    >
                      <Grid2x2Check className="size-5 mr-2" />
                      Alles zurückgeben
                    </Button>
                  </>
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

      {/* Partial Return Dialog */}
      <Dialog open={showPartialReturnDialog} onOpenChange={setShowPartialReturnDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teilrückgabe</DialogTitle>
            <DialogDescription>
              Wählen Sie die Gegenstände aus, die zurückgegeben werden
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Item selection list */}
            {selectedItems.map((item) => {
              const requestedCopies = getCopyCount(instanceData, item.id);
              const alreadyReturned = getReturnedCopyCount(rental?.returned_items, item.id);
              const remainingCopies = requestedCopies - alreadyReturned;
              const selectedCount = itemsToReturn[item.id] || 0;
              const depositPerCopy = item.deposit || 0;

              if (remainingCopies === 0) return null; // Skip fully returned items

              return (
                <div key={item.id} className="border rounded-lg p-4">
                  {/* Checkbox + Item display */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox
                          checked={selectedCount > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setItemsToReturn((prev) => ({ ...prev, [item.id]: remainingCopies }));
                            } else {
                              setItemsToReturn((prev) => {
                                const { [item.id]: _, ...rest } = prev;
                                return rest;
                              });
                            }
                          }}
                        />
                        <FormattedId id={item.iid} size="md" className="mr-2" />
                        <span className="font-semibold">{item.name}</span>
                      </div>

                      <div className="text-sm text-muted-foreground ml-6">
                        {remainingCopies} von {requestedCopies} noch ausstehend
                        {alreadyReturned > 0 && ` (${alreadyReturned} bereits zurück)`}
                        {depositPerCopy > 0 && ` • ${formatCurrency(depositPerCopy)} Pfand/Stück`}
                      </div>

                      {/* Copy counter for multi-copy items */}
                      {remainingCopies > 1 && selectedCount > 0 && (
                        <div className="flex items-center gap-2 ml-6 mt-2">
                          <Label className="text-xs">Anzahl:</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setItemsToReturn((prev) => ({
                                ...prev,
                                [item.id]: Math.max(1, selectedCount - 1),
                              }))
                            }
                            disabled={selectedCount <= 1}
                          >
                            <MinusIcon className="h-3 w-3" />
                          </Button>
                          <span className="font-mono font-semibold w-8 text-center">
                            {selectedCount}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setItemsToReturn((prev) => ({
                                ...prev,
                                [item.id]: Math.min(remainingCopies, selectedCount + 1),
                              }))
                            }
                            disabled={selectedCount >= remainingCopies}
                          >
                            <PlusIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Manual deposit entry */}
            <div className="border-t pt-4">
              <Label htmlFor="partial_deposit_back">Pfand zurückgeben (€)</Label>
              <Input
                id="partial_deposit_back"
                type="number"
                step="0.01"
                value={partialReturnDeposit}
                onChange={(e) => setPartialReturnDeposit(parseFloat(e.target.value) || 0)}
                className="mt-1"
                placeholder="Betrag eingeben"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Bitte geben Sie den Betrag manuell ein
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPartialReturnDialog(false);
                setItemsToReturn({});
                setPartialReturnDeposit(0);
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handlePartialReturn}
              disabled={Object.keys(itemsToReturn).length === 0 || isLoading}
            >
              Teilrückgabe durchführen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
