/**
 * Reservations page
 */

'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PlusIcon, CheckCircle2Icon, UserPlus, Check, X, ArrowRightIcon } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { FilterPopover } from '@/components/search/filter-popover';
import { SortableHeader, type SortDirection } from '@/components/table/sortable-header';
import { ColumnSelector } from '@/components/table/column-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReservationDetailSheet } from '@/components/detail-sheets/reservation-detail-sheet';
import { RentalDetailSheet } from '@/components/detail-sheets/rental-detail-sheet';
import { collections } from '@/lib/pocketbase/client';
import { useFilters } from '@/hooks/use-filters';
import { useColumnVisibility } from '@/hooks/use-column-visibility';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import { reservationsFilterConfig } from '@/lib/filters/filter-configs';
import { reservationsColumnConfig } from '@/lib/tables/column-configs';
import type { Reservation, ReservationExpanded, RentalExpanded, Customer } from '@/types';
import { formatDateTime } from '@/lib/utils/formatting';

export default function ReservationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [reservations, setReservations] = useState<ReservationExpanded[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<ReservationExpanded | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [hasInitializedFilter, setHasInitializedFilter] = useState(false);

  // Rental sheet state for converting reservation to rental
  const [isRentalSheetOpen, setIsRentalSheetOpen] = useState(false);
  const [rentalFromReservation, setRentalFromReservation] = useState<RentalExpanded | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);
  const perPage = 50;

  // Filter management
  const filters = useFilters({
    entity: 'reservations',
    config: reservationsFilterConfig,
  });

  // Calculate today's date range
  const todayRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    return { start: todayStr, end: todayStr };
  }, []);

  // Handle URL query parameters (action=new or view=id)
  useEffect(() => {
    const action = searchParams.get('action');
    const viewId = searchParams.get('view');

    if (action === 'new') {
      setSelectedReservation(null);
      setIsSheetOpen(true);
      // Clear the URL parameter
      router.replace('/reservations');
    } else if (viewId) {
      // Fetch the reservation by ID and open it
      collections.reservations().getOne<ReservationExpanded>(viewId, {
        expand: 'customer,items',
      }).then((reservation) => {
        setSelectedReservation(reservation);
        setIsSheetOpen(true);
        // Clear the URL parameter
        router.replace('/reservations');
      }).catch((err) => {
        console.error('Failed to load reservation:', err);
        router.replace('/reservations');
      });
    }
  }, [searchParams, router]);

  // Initialize "today" filter on first load if no filters exist
  useEffect(() => {
    // Only run once and only if there are no active filters
    if (!hasInitializedFilter && filters.activeFilters.length === 0) {
      filters.addFilter({
        type: 'date',
        field: 'pickup',
        operator: '>=',
        value: [todayRange.start, todayRange.end],
        label: 'Abholung: Heute',
      });
    }
    // Mark as initialized regardless (even if filters exist from localStorage)
    setHasInitializedFilter(true);
  }, [hasInitializedFilter, filters, todayRange]);

  // Sort management
  const [sortField, setSortField] = useState<string>(reservationsColumnConfig.defaultSort);
  const [sortColumn, setSortColumn] = useState<string | null>(null);

  // Column visibility management
  const columnVisibility = useColumnVisibility({
    entity: 'reservations',
    config: reservationsColumnConfig,
  });

  // Real-time subscription for live updates
  useRealtimeSubscription<Reservation>('reservation', {
    onCreated: async (reservation) => {
      // Fetch the reservation with expanded data
      try {
        const expandedReservation = await collections.reservations().getOne<ReservationExpanded>(
          reservation.id,
          { expand: 'items' }
        );
        setReservations((prev) => {
          // Check if reservation already exists (avoid duplicates)
          if (prev.some((r) => r.id === reservation.id)) {
            return prev;
          }
          // Add to beginning of list
          return [expandedReservation, ...prev];
        });
      } catch (err) {
        console.error('Error fetching expanded reservation:', err);
      }
    },
    onUpdated: async (reservation) => {
      // Fetch the reservation with expanded data
      try {
        const expandedReservation = await collections.reservations().getOne<ReservationExpanded>(
          reservation.id,
          { expand: 'items' }
        );
        setReservations((prev) =>
          prev.map((r) => (r.id === reservation.id ? expandedReservation : r))
        );
      } catch (err) {
        console.error('Error fetching expanded reservation:', err);
      }
    },
    onDeleted: (reservation) => {
      // Remove from list
      setReservations((prev) => prev.filter((r) => r.id !== reservation.id));
    },
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination when search, filters, or sort change
  useEffect(() => {
    setReservations([]);
    setCurrentPage(1);
    setHasMore(true);
  }, [debouncedSearch, filters.activeFilters, sortField]);

  const fetchReservations = useCallback(async (page: number) => {
    try {
      const isInitialLoad = page === 1;
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      // Build server-side filter from search and active filters
      const filter = filters.buildFilter(debouncedSearch);

      const result = await collections.reservations().getList<ReservationExpanded>(
        page,
        perPage,
        {
          sort: sortField,
          expand: 'items',
          filter,
          skipTotal: true,
        }
      );

      if (isInitialLoad) {
        setReservations(result.items);
      } else {
        setReservations((prev) => [...prev, ...result.items]);
      }

      setHasMore(result.items.length === perPage);
      setCurrentPage(page + 1);
      setError(null);
    } catch (err) {
      console.error('Error fetching reservations:', err);
      setError(
        err instanceof Error ? err.message : 'Fehler beim Laden der Reservierungen'
      );
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [debouncedSearch, filters.buildFilter, sortField, perPage]);

  // Initial load and reload on search change
  useEffect(() => {
    // Wait until filter initialization is complete before fetching
    if (!hasInitializedFilter) return;

    setCurrentPage(1);
    fetchReservations(1);
  }, [debouncedSearch, fetchReservations, hasInitializedFilter]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          fetchReservations(currentPage);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [fetchReservations, currentPage, hasMore, isLoading, isLoadingMore]);

  // Handle column sort
  const handleSort = (columnId: string) => {
    const column = reservationsColumnConfig.columns.find((c) => c.id === columnId);
    if (!column || !column.sortable) return;

    const field = column.sortField || columnId;

    // Toggle sort direction
    if (sortColumn === columnId) {
      // Currently sorting by this column, toggle direction
      setSortField(sortField.startsWith('-') ? field : `-${field}`);
    } else {
      // New column, start with ascending
      setSortColumn(columnId);
      setSortField(field);
    }
  };

  // Get sort direction for a column
  const getSortDirection = (columnId: string): SortDirection => {
    if (sortColumn !== columnId) return null;
    const column = reservationsColumnConfig.columns.find((c) => c.id === columnId);
    const field = column?.sortField || columnId;
    return sortField === field ? 'asc' : sortField === `-${field}` ? 'desc' : null;
  };

  // Handle row click to open detail sheet
  const handleRowClick = (reservation: ReservationExpanded) => {
    setSelectedReservation(reservation);
    setIsSheetOpen(true);
  };

  // Handle new reservation button
  const handleNewReservation = () => {
    setSelectedReservation(null);
    setIsSheetOpen(true);
  };

  // Handle reservation save
  const handleReservationSave = () => {
    // Refresh the list
    setReservations([]);
    setCurrentPage(1);
    fetchReservations(1);
  };

  // Handle converting reservation to rental
  const handleConvertToRental = async (reservation: ReservationExpanded) => {
    // Mark reservation as complete when converting to rental
    try {
      await collections.reservations().update(reservation.id, { done: true });
    } catch (err) {
      console.error('Error marking reservation as complete:', err);
      toast.error('Fehler beim Aktualisieren der Reservierung');
    }

    // Close reservation sheet
    setIsSheetOpen(false);

    // Create a template rental with data from reservation
    const templateRental: any = {
      id: '', // Empty ID indicates new rental
      customer: '', // Will be set by customer_iid
      items: reservation.items,
      deposit: 0, // Will be calculated from items
      deposit_back: 0,
      rented_on: new Date().toISOString(),
      returned_on: '',
      expected_on: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      extended_on: '',
      remark: reservation.comments || '',
      employee: '',
      employee_back: '',
      created: '',
      updated: '',
      collectionId: '',
      collectionName: 'rental',
      expand: {
        items: reservation.expand?.items || [],
      },
    };

    // If we have a customer IID, fetch the full customer data
    if (reservation.customer_iid) {
      try {
        const customer = await collections.customers().getFirstListItem<Customer>(`iid=${reservation.customer_iid}`);
        templateRental.customer = customer.id;
        templateRental.expand.customer = customer;
      } catch (err) {
        console.error('Error fetching customer:', err);
      }
    }

    setRentalFromReservation(templateRental as RentalExpanded);
    setIsRentalSheetOpen(true);
  };

  // Handle rental save
  const handleRentalSave = () => {
    setIsRentalSheetOpen(false);
    setRentalFromReservation(null);
    // Optionally refresh reservations list
    setReservations([]);
    setCurrentPage(1);
    fetchReservations(1);
  };

  // Render table header cell for a given column
  const renderHeaderCell = (columnId: string) => {
    switch (columnId) {
      case 'customer_name':
        return (
          <th key="customer_name" className="px-4 py-2 text-left">
            <SortableHeader
              label="Kunde"
              sortDirection={getSortDirection('customer_name')}
              onSort={() => handleSort('customer_name')}
              disabled={isLoading}
            />
          </th>
        );
      case 'items':
        return (
          <th key="items" className="px-4 py-2 text-left">
            <SortableHeader
              label="Gegenstände"
              sortDirection={getSortDirection('items')}
              onSort={() => handleSort('items')}
              disabled={isLoading}
            />
          </th>
        );
      case 'customer_phone':
        return (
          <th key="customer_phone" className="px-4 py-2 text-left">
            <SortableHeader
              label="Telefon"
              sortDirection={getSortDirection('customer_phone')}
              onSort={() => handleSort('customer_phone')}
              disabled={isLoading}
            />
          </th>
        );
      case 'pickup':
        return (
          <th key="pickup" className="px-4 py-2 text-left">
            <SortableHeader
              label="Abholung"
              sortDirection={getSortDirection('pickup')}
              onSort={() => handleSort('pickup')}
              disabled={isLoading}
            />
          </th>
        );
      case 'status':
        return (
          <th key="status" className="px-4 py-2 text-left">
            <button
              onClick={() => handleSort('status')}
              disabled={isLoading}
              className="flex items-center gap-1 hover:text-primary transition-colors"
              title="Status"
            >
              <CheckCircle2Icon className="size-4" />
            </button>
          </th>
        );
      case 'customer_email':
        return (
          <th key="customer_email" className="px-4 py-2 text-left">
            <SortableHeader
              label="Email"
              sortDirection={getSortDirection('customer_email')}
              onSort={() => handleSort('customer_email')}
              disabled={isLoading}
            />
          </th>
        );
      case 'customer_iid':
        return (
          <th key="customer_iid" className="px-4 py-2 text-left">
            <SortableHeader
              label="Kunden-ID"
              sortDirection={getSortDirection('customer_iid')}
              onSort={() => handleSort('customer_iid')}
              disabled={isLoading}
            />
          </th>
        );
      case 'is_new_customer':
        return (
          <th key="is_new_customer" className="px-4 py-2 text-left">
            <SortableHeader
              label={<UserPlus className="size-4" />}
              sortDirection={getSortDirection('is_new_customer')}
              onSort={() => handleSort('is_new_customer')}
              disabled={isLoading}
            />
          </th>
        );
      case 'comments':
        return (
          <th key="comments" className="px-4 py-2 text-left">
            <SortableHeader
              label="Kommentare"
              sortDirection={getSortDirection('comments')}
              onSort={() => handleSort('comments')}
              disabled={isLoading}
            />
          </th>
        );
      case 'on_premises':
        return (
          <th key="on_premises" className="px-4 py-2 text-left">
            <SortableHeader
              label="Vor Ort"
              sortDirection={getSortDirection('on_premises')}
              onSort={() => handleSort('on_premises')}
              disabled={isLoading}
            />
          </th>
        );
      case 'otp':
        return (
          <th key="otp" className="px-4 py-2 text-left">
            <span className="text-sm font-medium">OTP</span>
          </th>
        );
      case 'actions':
        return (
          <th key="actions" className="px-4 py-2 text-center">
            <span className="text-sm font-medium">Aktionen</span>
          </th>
        );
      default:
        return null;
    }
  };

  // Render table body cell for a given column and reservation
  const renderBodyCell = (columnId: string, reservation: ReservationExpanded) => {
    switch (columnId) {
      case 'customer_name':
        return (
          <td key="customer_name" className="px-4 py-3">
            {reservation.customer_iid ? (
              <span className="font-medium">
                <span className="font-mono text-primary mr-2">
                  #{String(reservation.customer_iid).padStart(4, '0')}
                </span>
                {reservation.customer_name}
              </span>
            ) : (
              <span className="font-medium">{reservation.customer_name}</span>
            )}
          </td>
        );
      case 'items':
        return (
          <td key="items" className="px-4 py-3 text-sm">
            {reservation.expand?.items?.length > 0
              ? reservation.expand.items.map((item) => (
                  <span key={item.id} className="inline-block mr-2">
                    <span className="font-mono text-primary">
                      #{String(item.iid).padStart(4, '0')}
                    </span>
                    {' '}
                    {item.name}
                  </span>
                ))
              : `${reservation.items.length} Gegenstände`}
          </td>
        );
      case 'customer_phone':
        return (
          <td key="customer_phone" className="px-4 py-3 text-sm text-muted-foreground">
            {reservation.customer_phone || '—'}
          </td>
        );
      case 'pickup':
        return (
          <td key="pickup" className="px-4 py-3 text-sm text-muted-foreground">
            {formatDateTime(reservation.pickup)}
          </td>
        );
      case 'status':
        return (
          <td key="status" className="px-4 py-3">
            <Badge variant={reservation.done ? 'default' : 'outline'}>
              {reservation.done ? 'Erledigt' : 'Offen'}
            </Badge>
          </td>
        );
      case 'customer_email':
        return (
          <td key="customer_email" className="px-4 py-3 text-sm text-muted-foreground">
            {reservation.customer_email || '—'}
          </td>
        );
      case 'customer_iid':
        return (
          <td key="customer_iid" className="px-4 py-3 text-sm font-mono">
            {reservation.customer_iid
              ? String(reservation.customer_iid).padStart(4, '0')
              : '—'}
          </td>
        );
      case 'is_new_customer':
        return (
          <td key="is_new_customer" className="px-4 py-3 text-sm">
            {reservation.is_new_customer ? (
              <Check className="size-4 text-green-600" />
            ) : (
              <X className="size-4 text-muted-foreground" />
            )}
          </td>
        );
      case 'comments':
        return (
          <td key="comments" className="px-4 py-3 text-sm">
            {reservation.comments || '—'}
          </td>
        );
      case 'on_premises':
        return (
          <td key="on_premises" className="px-4 py-3 text-sm">
            {reservation.on_premises ? (
              <Check className="size-4 text-green-600" />
            ) : (
              <X className="size-4 text-muted-foreground" />
            )}
          </td>
        );
      case 'otp':
        return (
          <td key="otp" className="px-4 py-3 text-sm font-mono">
            {reservation.otp || '—'}
          </td>
        );
      case 'actions':
        return (
          <td key="actions" className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="default"
                className="h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleConvertToRental(reservation);
                }}
                title="In Ausleihe umwandeln"
              >
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b-2 border-primary bg-background p-4">
        <div className="flex gap-2">
          <Button onClick={handleNewReservation} size="sm" className="h-10">
            <PlusIcon className="size-4 mr-2" />
            Neu
          </Button>
          <FilterPopover
            open={filters.isFilterPopoverOpen}
            onOpenChange={filters.setIsFilterPopoverOpen}
            statusFilters={reservationsFilterConfig.statusFilters}
            dateFilters={reservationsFilterConfig.dateFilters}
            categoryFilters={reservationsFilterConfig.categoryFilters}
            activeFilters={filters.activeFilters}
            onAddFilter={filters.addFilter}
            onRemoveFilter={filters.removeFilter}
            onClearAll={filters.clearAllFilters}
          >
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Reservierungen suchen..."
                disabled={isLoading}
                filters={filters.activeFilters}
                onRemoveFilter={filters.removeFilter}
                onFilterClick={filters.toggleFilterPopover}
                filterCount={filters.filterCount}
              />
            </div>
          </FilterPopover>
          <ColumnSelector
            columns={reservationsColumnConfig.columns}
            visibleColumns={columnVisibility.visibleColumns}
            columnOrder={columnVisibility.columnOrder}
            onToggle={columnVisibility.toggleColumn}
            onReset={columnVisibility.resetColumns}
            onResetOrder={columnVisibility.resetOrder}
            onReorderColumns={columnVisibility.reorderColumns}
            hiddenCount={columnVisibility.hiddenCount}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive font-medium">Fehler: {error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Bitte überprüfen Sie Ihre PocketBase-Verbindung
            </p>
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {debouncedSearch ? 'Keine Ergebnisse gefunden' : 'Keine Reservierungen gefunden'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-primary">
                  {columnVisibility.getOrderedColumns(true).map(renderHeaderCell)}
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr
                    key={reservation.id}
                    onClick={() => handleRowClick(reservation)}
                    className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    {columnVisibility.getOrderedColumns(true).map((columnId) => renderBodyCell(columnId, reservation))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Infinite scroll trigger */}
            <div ref={observerTarget} className="h-4" />

            {/* Loading more indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <div className="h-6 w-6 animate-spin border-4 border-primary border-t-transparent" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Lädt mehr...
                </span>
              </div>
            )}

            {/* End of results */}
            {!hasMore && reservations.length > 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Alle Reservierungen geladen
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reservation Detail Sheet */}
      <ReservationDetailSheet
        reservation={selectedReservation}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onSave={handleReservationSave}
        onConvertToRental={handleConvertToRental}
      />

      {/* Rental Detail Sheet (for converting reservations) */}
      <RentalDetailSheet
        rental={rentalFromReservation}
        open={isRentalSheetOpen}
        onOpenChange={setIsRentalSheetOpen}
        onSave={handleRentalSave}
      />
    </div>
  );
}
