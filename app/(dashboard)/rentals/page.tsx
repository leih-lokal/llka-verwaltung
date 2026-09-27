/**
 * Rentals page
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PlusIcon, BadgeCheckIcon, CoinsIcon, WalletIcon, SmileIcon, ChevronLeft, ChevronRight, CircleCheckBig, CheckLine, Check } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { FilterPopover } from '@/components/search/filter-popover';
import { SortableHeader, ariaSort, type SortDirection } from '@/components/table/sortable-header';
import { ColumnSelector } from '@/components/table/column-selector';
import { EmptyState } from '@/components/table/empty-state';
import { RowOpenButton } from '@/components/table/row-open-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RentalDetailSheet } from '@/components/detail-sheets/rental-detail-sheet';
import { collections } from '@/lib/pocketbase/client';
import { useFilters } from '@/hooks/use-filters';
import { useColumnVisibility } from '@/hooks/use-column-visibility';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import { rentalsFilterConfig } from '@/lib/filters/filter-configs';
import { buildRecordInListFilter } from '@/lib/filters/filter-utils';
import { rentalsColumnConfig } from '@/lib/tables/column-configs';
import type { Rental, RentalExpanded } from '@/types';
import { formatDate, calculateRentalStatus } from '@/lib/utils/formatting';
import { getRentalStatusLabel, RENTAL_STATUS_COLORS } from '@/lib/constants/statuses';
import { getCopyCount } from '@/lib/utils/instance-data';
import { getReturnedCopyCount } from '@/lib/utils/partial-returns';
import { cn } from '@/lib/utils';
import { createRentalTemplate } from '@/lib/utils/rental-template';
import { toast } from 'sonner';
import { FormattedId } from '@/components/ui/formatted-id';

/** Columns that can carry the row's open button, by preference */
const OPEN_BUTTON_COLUMNS = ['customer', 'rented_on'];

export default function RentalsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [rentals, setRentals] = useState<RentalExpanded[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRental, setSelectedRental] = useState<RentalExpanded | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sourceReservationId, setSourceReservationId] = useState<string | undefined>(undefined);

  const observerTarget = useRef<HTMLDivElement>(null);
  // Bumped by every list request so responses of superseded ones are dropped
  const requestIdRef = useRef(0);
  const perPage = 50;

  // Filter management
  const filters = useFilters({
    entity: 'rentals',
    config: rentalsFilterConfig,
  });

  // Sort management
  const [sortField, setSortField] = useState<string>(rentalsColumnConfig.defaultSort);
  const [sortColumn, setSortColumn] = useState<string | null>(null);

  // Column visibility management
  const columnVisibility = useColumnVisibility({
    entity: 'rentals',
    config: rentalsColumnConfig,
  });

  // Fetch a rental (expanded) only if it matches the current search and
  // filters; null otherwise
  const fetchIfListed = async (id: string) => {
    const result = await collections.rentals().getList<RentalExpanded>(1, 1, {
      filter: buildRecordInListFilter(id, filters.buildFilter(debouncedSearch)),
      expand: 'customer,items',
      skipTotal: true,
    });
    return result.items[0] ?? null;
  };

  // Real-time subscription for live updates
  useRealtimeSubscription<Rental>('rental', {
    onCreated: async (rental) => {
      try {
        const expandedRental = await fetchIfListed(rental.id);
        if (!expandedRental) return;
        setRentals((prev) => {
          // Check if rental already exists (avoid duplicates)
          if (prev.some((r) => r.id === rental.id)) {
            return prev;
          }
          // Add to beginning of list
          return [expandedRental, ...prev];
        });
      } catch (err) {
        console.error('Error fetching expanded rental:', err);
      }
    },
    onUpdated: async (rental) => {
      try {
        const expandedRental = await fetchIfListed(rental.id);
        // Drop it if it no longer matches the filters
        setRentals((prev) =>
          expandedRental
            ? prev.map((r) => (r.id === rental.id ? expandedRental : r))
            : prev.filter((r) => r.id !== rental.id)
        );
      } catch (err) {
        console.error('Error fetching expanded rental:', err);
      }
    },
    onDeleted: (rental) => {
      // Remove from list
      setRentals((prev) => prev.filter((r) => r.id !== rental.id));
    },
  });

  // Handle URL query parameters (action=new or view=id)
  useEffect(() => {
    const action = searchParams.get('action');
    const viewId = searchParams.get('view');

    if (action === 'new') {
      // Check for pre-fill parameters from reservation conversion
      const customerIidParam = searchParams.get('customer_iid');
      const itemIdsParam = searchParams.get('item_ids');
      const fromReservationId = searchParams.get('from_reservation');
      const pickup = searchParams.get('pickup');

      // If we have pre-fill data, create a template rental
      if (customerIidParam || itemIdsParam) {
        const customerIid = customerIidParam ? parseInt(customerIidParam, 10) : undefined;
        const itemIids = itemIdsParam
          ? itemIdsParam.split(',').map((id) => parseInt(id, 10))
          : undefined;

        createRentalTemplate({
          customerIid,
          itemIids,
          reservationId: fromReservationId || undefined,
          pickup: pickup || undefined,
        }).then((template) => {
          if (template) {
            setSelectedRental(template);
            setSourceReservationId(fromReservationId || undefined);
          } else {
            // Template creation failed, open empty form
            setSelectedRental(null);
            setSourceReservationId(undefined);
            toast.warning('Daten konnten nicht vorausgefüllt werden');
          }
          setIsSheetOpen(true);
          // Clear the URL parameters
          router.replace('/rentals');
        });
      } else {
        // No pre-fill data, open empty form
        setSelectedRental(null);
        setSourceReservationId(undefined);
        setIsSheetOpen(true);
        // Clear the URL parameter
        router.replace('/rentals');
      }
    } else if (viewId) {
      // Fetch the rental by ID and open it
      collections.rentals().getOne<RentalExpanded>(viewId, {
        expand: 'customer,items',
      }).then((rental) => {
        setSelectedRental(rental);
        setSourceReservationId(undefined);
        setIsSheetOpen(true);
        // Clear the URL parameter
        router.replace('/rentals');
      }).catch((err) => {
        console.error('Failed to load rental:', err);
        router.replace('/rentals');
      });
    }
  }, [searchParams, router]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchRentals = useCallback(async (page: number) => {
    // A request started after this one (new filter, sort or page) wins, even
    // if this response arrives later
    const requestId = ++requestIdRef.current;
    const isStale = () => requestId !== requestIdRef.current;

    try {
      const isInitialLoad = page === 1;
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      // Build server-side filter from search and active filters
      const filter = filters.buildFilter(debouncedSearch);

      const result = await collections.rentals().getList<RentalExpanded>(
        page,
        perPage,
        {
          sort: sortField,
          expand: 'customer,items',
          filter,
          skipTotal: true,
        }
      );
      if (isStale()) return;

      if (isInitialLoad) {
        setRentals(result.items);
      } else {
        setRentals((prev) => [...prev, ...result.items]);
      }

      setHasMore(result.items.length === perPage);
      setCurrentPage(page + 1);
      setError(null);
    } catch (err) {
      if (isStale()) return;
      console.error('Error fetching rentals:', err);
      setError(
        err instanceof Error ? err.message : 'Fehler beim Laden der Leihvorgänge'
      );
    } finally {
      if (!isStale()) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [debouncedSearch, filters.buildFilter, sortField, perPage]);

  // Keep a stable ref to the latest fetchRentals so effects that want to
  // call it don't need to depend on its identity (which changes whenever
  // filters.buildFilter recomposes).
  const fetchRef = useRef(fetchRentals);
  fetchRef.current = fetchRentals;

  // Reset + fetch in a single effect keyed on the actual inputs.
  // Previously this was two effects (reset pagination, then fetch via
  // fetchRentals-identity), which meant every filter-string mutation
  // tore down and rebuilt the infinite-scroll observer below.
  useEffect(() => {
    setRentals([]);
    setCurrentPage(1);
    setHasMore(true);
    fetchRef.current(1);
  }, [debouncedSearch, filters.activeFilters, sortField]);

  // Intersection Observer for infinite scroll. Depends only on pagination
  // state — not fetchRentals identity — so it isn't recreated on every
  // keystroke-after-debounce.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          fetchRef.current(currentPage);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [currentPage, hasMore, isLoading, isLoadingMore]);

  // Handle column sort
  const handleSort = (columnId: string) => {
    const column = rentalsColumnConfig.columns.find((c) => c.id === columnId);
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
    const column = rentalsColumnConfig.columns.find((c) => c.id === columnId);
    const field = column?.sortField || columnId;
    return sortField === field ? 'asc' : sortField === `-${field}` ? 'desc' : null;
  };

  // Handle row click to open detail sheet
  const handleRowClick = (rental: RentalExpanded) => {
    setSelectedRental(rental);
    setSourceReservationId(undefined);
    setIsSheetOpen(true);
  };

  // Handle new rental button
  const handleNewRental = () => {
    setSelectedRental(null);
    setSourceReservationId(undefined);
    setIsSheetOpen(true);
  };

  // Forget the reservation being converted whenever the sheet closes, so a
  // later, unrelated rental can't mark it done
  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      setSourceReservationId(undefined);
    }
  };

  // Handle rental save
  const handleRentalSave = () => {
    // Refresh the list
    setRentals([]);
    setCurrentPage(1);
    fetchRentals(1);
    setSourceReservationId(undefined);
  };

  // Render table header cell for a given column
  const renderHeaderCell = (columnId: string) => {
    const dividerClass = columnVisibility.verticalDividers ? 'border-l first:border-l-0 border-border/30' : '';

    switch (columnId) {
      case 'customer':
        return (
          <th key="customer" className={cn("px-4 py-2 text-left", dividerClass)} aria-sort={ariaSort(getSortDirection('customer'))}>
            <SortableHeader
              label="Nutzer"
              sortDirection={getSortDirection('customer')}
              onSort={() => handleSort('customer')}
              disabled={isLoading}
            />
          </th>
        );
      case 'items':
        return (
          <th key="items" className={cn("px-4 py-2 text-left", dividerClass)} aria-sort={ariaSort(getSortDirection('items'))}>
            <SortableHeader
              label="Gegenstände"
              sortDirection={getSortDirection('items')}
              onSort={() => handleSort('items')}
              disabled={isLoading}
            />
          </th>
        );
      case 'rented_on':
        return (
          <th key="rented_on" className={cn("px-4 py-2 text-left", dividerClass)} aria-sort={ariaSort(getSortDirection('rented_on'))}>
            <SortableHeader
              label="Ausgeliehen"
              sortDirection={getSortDirection('rented_on')}
              onSort={() => handleSort('rented_on')}
              disabled={isLoading}
            />
          </th>
        );
      case 'expected_on':
        return (
          <th key="expected_on" className={cn("px-4 py-2 text-left", dividerClass)} aria-sort={ariaSort(getSortDirection('expected_on'))}>
            <SortableHeader
              label="Erwartet"
              sortDirection={getSortDirection('expected_on')}
              onSort={() => handleSort('expected_on')}
              disabled={isLoading}
            />
          </th>
        );
      case 'returned_on':
        return (
          <th key="returned_on" className={cn("px-4 py-2 text-left", dividerClass)} aria-sort={ariaSort(getSortDirection('returned_on'))}>
            <SortableHeader
              label="Zurück"
              sortDirection={getSortDirection('returned_on')}
              onSort={() => handleSort('returned_on')}
              disabled={isLoading}
            />
          </th>
        );
      case 'status':
        return (
          <th key="status" className={cn("px-4 py-2 text-left", dividerClass)} title="Status">
            <BadgeCheckIcon className="size-4" />
          </th>
        );
      case 'extended_on':
        return (
          <th key="extended_on" className={cn("px-4 py-2 text-left", dividerClass)} aria-sort={ariaSort(getSortDirection('extended_on'))}>
            <SortableHeader
              label="Verlängert"
              sortDirection={getSortDirection('extended_on')}
              onSort={() => handleSort('extended_on')}
              disabled={isLoading}
            />
          </th>
        );
      case 'deposit':
        return (
          <th key="deposit" className={cn("px-4 py-2 text-left", dividerClass)} aria-sort={ariaSort(getSortDirection('deposit'))}>
            <button
              onClick={() => handleSort('deposit')}
              disabled={isLoading}
              className="flex items-center gap-1 hover:text-primary transition-colors"
              title="Kaution"
            >
              <CoinsIcon className="size-4" />
            </button>
          </th>
        );
      case 'deposit_back':
        return (
          <th key="deposit_back" className={cn("px-4 py-2 text-left", dividerClass)} aria-sort={ariaSort(getSortDirection('deposit_back'))}>
            <button
              onClick={() => handleSort('deposit_back')}
              disabled={isLoading}
              className="flex items-center gap-1 hover:text-primary transition-colors"
              title="Kaution zurück"
            >
              <WalletIcon className="size-4" />
            </button>
          </th>
        );
      case 'remark':
        return (
          <th key="remark" className={cn("px-4 py-2 text-left", dividerClass)} aria-sort={ariaSort(getSortDirection('remark'))}>
            <SortableHeader
              label="Bemerkung"
              sortDirection={getSortDirection('remark')}
              onSort={() => handleSort('remark')}
              disabled={isLoading}
            />
          </th>
        );
      case 'employee':
        return (
          <th key="employee" className={cn("px-4 py-2 text-left", dividerClass)} aria-sort={ariaSort(getSortDirection('employee'))}>
            <SortableHeader
            label={
              <div className="flex items-center gap-1">
                <SmileIcon className="size-4" />
                <ChevronRight className="size-4" />
              </div>
            }
              ariaLabel="Mitarbeiter Ausgabe"
              sortDirection={getSortDirection('employee')}
              onSort={() => handleSort('employee')}
              disabled={isLoading}
            />
          </th>
        );
      case 'employee_back':
        return (
          <th key="employee_back" className={cn("px-4 py-2 text-left", dividerClass)} aria-sort={ariaSort(getSortDirection('employee_back'))}>
            <SortableHeader
            label={
              <div className="flex items-center gap-1">
                <SmileIcon className="size-4" />
                <ChevronLeft className="size-4" />
              </div>
            }
              ariaLabel="Mitarbeiter Rücknahme"
              sortDirection={getSortDirection('employee_back')}
              onSort={() => handleSort('employee_back')}
              disabled={isLoading}
            />
          </th>
        );
      default:
        return null;
    }
  };

  // The row's open button goes into the first of these columns that is shown
  const openColumnId = OPEN_BUTTON_COLUMNS.find((id) =>
    columnVisibility.visibleColumns.includes(id)
  );

  // Render table body cell for a given column and rental
  const renderBodyCell = (columnId: string, rental: RentalExpanded) => {
    const status = calculateRentalStatus(rental);
    const dividerClass = columnVisibility.verticalDividers ? 'border-l first:border-l-0 border-border/30' : '';
    // Keyboard/screen-reader access to the row's click action
    const openable = (content: React.ReactNode) => {
      if (columnId !== openColumnId) return content;
      const customer = rental.expand?.customer;
      const label = customer
        ? `Ausleihe von ${String(customer.iid).padStart(4, '0')} ${customer.firstname} ${customer.lastname} vom ${formatDate(rental.rented_on)} öffnen`
        : `Ausleihe vom ${formatDate(rental.rented_on)} öffnen`;
      return (
        <RowOpenButton label={label} onOpen={() => handleRowClick(rental)}>
          {content}
        </RowOpenButton>
      );
    };

    switch (columnId) {
      case 'customer':
        return (
          <td key="customer" className={cn("px-4 py-3", dividerClass)}>
            {openable(
              rental.expand?.customer ? (
                <span className="font-medium">
                  <span className="font-mono text-primary font-semibold mr-2">
                    {String(rental.expand.customer.iid).padStart(4, '0')}
                  </span>
                  {rental.expand.customer.firstname}{' '}
                  {rental.expand.customer.lastname}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            )}
          </td>
        );
      case 'items':
        return (
          <td key="items" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {rental.expand?.items?.length > 0 ? (
              <div className="space-y-1">
                {rental.expand.items.map((item) => {
                  const copyCount = getCopyCount(rental.requested_copies, item.id);
                  const returnedCount = getReturnedCopyCount(rental.returned_items, item.id);
                  const hasPartialReturn = returnedCount > 0 && returnedCount < copyCount;
                  const isFullyReturned = returnedCount > 0 && returnedCount === copyCount;
                  // Also check if entire rental is returned (for non-partial returns)
                  const isRentalReturned = rental.returned_on;

                  return (
                    <span key={item.id} className="inline-block mr-2">
                      <FormattedId id={item.iid} size="md" className="mr-2" />
                      {item.name}
                      {copyCount > 1 && (
                        <span className="ml-1 text-xs text-neutral-600 font-medium">
                          (×{copyCount})
                        </span>
                      )}
                      {hasPartialReturn && (
                        <span className="ml-1 text-xs font-semibold text-green-800">
                          {returnedCount}/{copyCount} zurück
                        </span>
                      )}
                      {(isFullyReturned || isRentalReturned) && (
                        <>
                          <Check strokeWidth={4} className="inline-block ml-1 size-3.5 text-green-700" />
                          <span className="sr-only">zurückgegeben</span>
                        </>
                      )}
                    </span>
                  );
                })}
              </div>
            ) : (
              `${rental.items.length} Gegenstände`
            )}
          </td>
        );
      case 'rented_on':
        return (
          <td key="rented_on" className={cn("px-4 py-3 text-sm text-neutral-600", dividerClass)}>
            {openable(formatDate(rental.rented_on))}
          </td>
        );
      case 'expected_on':
        return (
          <td key="expected_on" className={cn("px-4 py-3 text-sm text-neutral-600", dividerClass)}>
            {formatDate(rental.expected_on)}
          </td>
        );
      case 'returned_on':
        return (
          <td key="returned_on" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {rental.returned_on ? formatDate(rental.returned_on) : '—'}
          </td>
        );
      case 'status':
        return (
          <td key="status" className={cn("px-4 py-3", dividerClass)}>
            <Badge
              variant="outline"
              className={cn(
                status === 'active' && 'bg-red-600 text-white border-red-600'
              )}
            >
              {getRentalStatusLabel(status)}
            </Badge>
          </td>
        );
      case 'extended_on':
        return (
          <td key="extended_on" className={cn("px-4 py-3 text-sm text-neutral-600", dividerClass)}>
            {rental.extended_on ? formatDate(rental.extended_on) : '—'}
          </td>
        );
      case 'deposit':
        return (
          <td key="deposit" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {rental.deposit > 0 ? `${rental.deposit} €` : '—'}
          </td>
        );
      case 'deposit_back':
        return (
          <td key="deposit_back" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {rental.deposit_back > 0 ? `${rental.deposit_back} €` : '—'}
          </td>
        );
      case 'remark':
        return (
          <td key="remark" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {rental.remark || '—'}
          </td>
        );
      case 'employee':
        return (
          <td key="employee" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {rental.employee || '—'}
          </td>
        );
      case 'employee_back':
        return (
          <td key="employee_back" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {rental.employee_back || '—'}
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
          <Button onClick={handleNewRental} size="sm" className="h-10">
            <PlusIcon className="size-4 mr-2" />
            Neu
          </Button>
          <FilterPopover
            open={filters.isFilterPopoverOpen}
            onOpenChange={filters.setIsFilterPopoverOpen}
            statusFilters={rentalsFilterConfig.statusFilters}
            dateFilters={rentalsFilterConfig.dateFilters}
            numericFilters={rentalsFilterConfig.numericFilters}
            textFilters={rentalsFilterConfig.textFilters}
            activeFilters={filters.activeFilters}
            onAddFilter={filters.addFilter}
            onRemoveFilter={filters.removeFilter}
            onClearAll={filters.clearAllFilters}
          >
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Leihvorgänge suchen..."
                disabled={isLoading}
                filters={filters.activeFilters}
                onRemoveFilter={filters.removeFilter}
                onFilterClick={filters.toggleFilterPopover}
                filterCount={filters.filterCount}
              />
            </div>
          </FilterPopover>
          <ColumnSelector
            columns={rentalsColumnConfig.columns}
            visibleColumns={columnVisibility.visibleColumns}
            columnOrder={columnVisibility.columnOrder}
            onToggle={columnVisibility.toggleColumn}
            onReset={columnVisibility.resetColumns}
            onResetOrder={columnVisibility.resetOrder}
            onReorderColumns={columnVisibility.reorderColumns}
            hiddenCount={columnVisibility.hiddenCount}
            verticalDividers={columnVisibility.verticalDividers}
            onToggleVerticalDividers={columnVisibility.toggleVerticalDividers}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div role="status" className="flex items-center justify-center py-8">
            <div aria-hidden="true" className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent" />
            <span className="sr-only">Lädt…</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive font-medium">Fehler: {error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Bitte überprüfen Sie Ihre PocketBase-Verbindung
            </p>
          </div>
        ) : rentals.length === 0 ? (
          <EmptyState entity="rentals" hasSearch={!!debouncedSearch} />
        ) : (
          <>
            <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-primary">
                      {columnVisibility.getOrderedColumns(true).map(renderHeaderCell)}
                    </tr>
                  </thead>
                  <tbody>
                    {rentals.map((rental) => {
                      const status = calculateRentalStatus(rental);
                      const statusColor = RENTAL_STATUS_COLORS[status];

                      return (
                        <tr
                          key={rental.id}
                          onClick={() => handleRowClick(rental)}
                          className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                          style={{ backgroundColor: statusColor }}
                        >
                          {columnVisibility.getOrderedColumns(true).map((columnId) => renderBodyCell(columnId, rental))}
                        </tr>
                      );
                })}
              </tbody>
            </table>

            {/* Infinite scroll trigger */}
            <div ref={observerTarget} className="h-4" />

            {/* Loading more indicator (polite live region, kept mounted) */}
            <div role="status">
              {isLoadingMore && (
                <div className="flex items-center justify-center py-4">
                  <div aria-hidden="true" className="h-6 w-6 animate-spin border-4 border-primary border-t-transparent" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Lädt mehr...
                  </span>
                </div>
              )}
            </div>

            {/* End of results */}
            {!hasMore && rentals.length > 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Alle Leihvorgänge geladen
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Rental Detail Sheet */}
      <RentalDetailSheet
        rental={selectedRental}
        open={isSheetOpen}
        onOpenChange={handleSheetOpenChange}
        onSave={handleRentalSave}
        sourceReservationId={sourceReservationId}
      />
    </div>
  );
}
