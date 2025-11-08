/**
 * Rentals page
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PlusIcon, BadgeCheckIcon, CoinsIcon, WalletIcon } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { FilterPopover } from '@/components/search/filter-popover';
import { SortableHeader, type SortDirection } from '@/components/table/sortable-header';
import { ColumnSelector } from '@/components/table/column-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RentalDetailSheet } from '@/components/detail-sheets/rental-detail-sheet';
import { collections } from '@/lib/pocketbase/client';
import { useFilters } from '@/hooks/use-filters';
import { useColumnVisibility } from '@/hooks/use-column-visibility';
import { rentalsFilterConfig } from '@/lib/filters/filter-configs';
import { rentalsColumnConfig } from '@/lib/tables/column-configs';
import type { RentalExpanded } from '@/types';
import { formatDate, calculateRentalStatus } from '@/lib/utils/formatting';
import { getRentalStatusLabel, RENTAL_STATUS_COLORS } from '@/lib/constants/statuses';

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

  const observerTarget = useRef<HTMLDivElement>(null);
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

  // Handle URL query parameters (action=new or view=id)
  useEffect(() => {
    const action = searchParams.get('action');
    const viewId = searchParams.get('view');

    if (action === 'new') {
      setSelectedRental(null);
      setIsSheetOpen(true);
      // Clear the URL parameter
      router.replace('/rentals');
    } else if (viewId) {
      // Fetch the rental by ID and open it
      collections.rentals().getOne<RentalExpanded>(viewId, {
        expand: 'customer,items',
      }).then((rental) => {
        setSelectedRental(rental);
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

  // Reset pagination when search, filters, or sort change
  useEffect(() => {
    setRentals([]);
    setCurrentPage(1);
    setHasMore(true);
  }, [debouncedSearch, filters.activeFilters, sortField]);

  const fetchRentals = useCallback(async (page: number) => {
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

      if (isInitialLoad) {
        setRentals(result.items);
      } else {
        setRentals((prev) => [...prev, ...result.items]);
      }

      setHasMore(result.items.length === perPage);
      setCurrentPage(page + 1);
      setError(null);
    } catch (err) {
      console.error('Error fetching rentals:', err);
      setError(
        err instanceof Error ? err.message : 'Fehler beim Laden der Leihvorgänge'
      );
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [debouncedSearch, filters.buildFilter, sortField, perPage]);

  // Initial load and reload on search change
  useEffect(() => {
    setCurrentPage(1);
    fetchRentals(1);
  }, [debouncedSearch, fetchRentals]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          fetchRentals(currentPage);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [fetchRentals, currentPage, hasMore, isLoading, isLoadingMore]);

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
    setIsSheetOpen(true);
  };

  // Handle new rental button
  const handleNewRental = () => {
    setSelectedRental(null);
    setIsSheetOpen(true);
  };

  // Handle rental save
  const handleRentalSave = () => {
    // Refresh the list
    setRentals([]);
    setCurrentPage(1);
    fetchRentals(1);
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
            onToggle={columnVisibility.toggleColumn}
            onReset={columnVisibility.resetColumns}
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
        ) : rentals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {debouncedSearch ? 'Keine Ergebnisse gefunden' : 'Keine Leihvorgänge gefunden'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-primary">
                      {columnVisibility.isColumnVisible('customer') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Kunde"
                            sortDirection={getSortDirection('customer')}
                            onSort={() => handleSort('customer')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('items') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Gegenstände"
                            sortDirection={getSortDirection('items')}
                            onSort={() => handleSort('items')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('rented_on') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Ausgeliehen"
                            sortDirection={getSortDirection('rented_on')}
                            onSort={() => handleSort('rented_on')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('expected_on') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Erwartet"
                            sortDirection={getSortDirection('expected_on')}
                            onSort={() => handleSort('expected_on')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('returned_on') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Zurück"
                            sortDirection={getSortDirection('returned_on')}
                            onSort={() => handleSort('returned_on')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('status') && (
                        <th className="px-4 py-2 text-left" title="Status">
                          <BadgeCheckIcon className="size-4" />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('extended_on') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Verlängert"
                            sortDirection={getSortDirection('extended_on')}
                            onSort={() => handleSort('extended_on')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('deposit') && (
                        <th className="px-4 py-2 text-left">
                          <button
                            onClick={() => handleSort('deposit')}
                            disabled={isLoading}
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                            title="Kaution"
                          >
                            <CoinsIcon className="size-4" />
                          </button>
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('deposit_back') && (
                        <th className="px-4 py-2 text-left">
                          <button
                            onClick={() => handleSort('deposit_back')}
                            disabled={isLoading}
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                            title="Kaution zurück"
                          >
                            <WalletIcon className="size-4" />
                          </button>
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('remark') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Bemerkung"
                            sortDirection={getSortDirection('remark')}
                            onSort={() => handleSort('remark')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('employee') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Mitarbeiter (Aus)"
                            sortDirection={getSortDirection('employee')}
                            onSort={() => handleSort('employee')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('employee_back') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Mitarbeiter (Ein)"
                            sortDirection={getSortDirection('employee_back')}
                            onSort={() => handleSort('employee_back')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
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
                      const statusColor = RENTAL_STATUS_COLORS[status];

                      return (
                        <tr
                          key={rental.id}
                          onClick={() => handleRowClick(rental)}
                          className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                          style={{ backgroundColor: statusColor }}
                        >
                          {columnVisibility.isColumnVisible('customer') && (
                            <td className="px-4 py-3">
                              {rental.expand?.customer ? (
                                <span className="font-medium">
                                  <span className="font-mono text-primary mr-2">
                                    #{String(rental.expand.customer.iid).padStart(4, '0')}
                                  </span>
                                  {rental.expand.customer.firstname}{' '}
                                  {rental.expand.customer.lastname}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          )}
                          {columnVisibility.isColumnVisible('items') && (
                            <td className="px-4 py-3 text-sm">
                              {rental.expand?.items?.length > 0
                                ? rental.expand.items.map((item) => (
                                    <span key={item.id} className="inline-block mr-2">
                                      <span className="font-mono text-primary">
                                        #{String(item.iid).padStart(4, '0')}
                                      </span>
                                      {' '}
                                      {item.name}
                                    </span>
                                  ))
                                : `${rental.items.length} Gegenstände`}
                            </td>
                          )}
                          {columnVisibility.isColumnVisible('rented_on') && (
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {formatDate(rental.rented_on)}
                            </td>
                          )}
                          {columnVisibility.isColumnVisible('expected_on') && (
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {formatDate(rental.extended_on || rental.expected_on)}
                            </td>
                          )}
                          {columnVisibility.isColumnVisible('returned_on') && (
                            <td className="px-4 py-3 text-sm">
                              {rental.returned_on ? formatDate(rental.returned_on) : '—'}
                            </td>
                          )}
                          {columnVisibility.isColumnVisible('status') && (
                            <td className="px-4 py-3">
                              <Badge variant="outline">
                                {getRentalStatusLabel(status)}
                              </Badge>
                            </td>
                          )}
                          {columnVisibility.isColumnVisible('extended_on') && (
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {rental.extended_on ? formatDate(rental.extended_on) : '—'}
                            </td>
                          )}
                          {columnVisibility.isColumnVisible('deposit') && (
                            <td className="px-4 py-3 text-sm">
                              {rental.deposit > 0 ? `${rental.deposit} €` : '—'}
                            </td>
                          )}
                          {columnVisibility.isColumnVisible('deposit_back') && (
                            <td className="px-4 py-3 text-sm">
                              {rental.deposit_back > 0 ? `${rental.deposit_back} €` : '—'}
                            </td>
                          )}
                          {columnVisibility.isColumnVisible('remark') && (
                            <td className="px-4 py-3 text-sm">
                              {rental.remark || '—'}
                            </td>
                          )}
                          {columnVisibility.isColumnVisible('employee') && (
                            <td className="px-4 py-3 text-sm">
                              {rental.employee || '—'}
                            </td>
                          )}
                          {columnVisibility.isColumnVisible('employee_back') && (
                            <td className="px-4 py-3 text-sm">
                              {rental.employee_back || '—'}
                            </td>
                          )}
                        </tr>
                      );
                })}
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
        onOpenChange={setIsSheetOpen}
        onSave={handleRentalSave}
      />
    </div>
  );
}
