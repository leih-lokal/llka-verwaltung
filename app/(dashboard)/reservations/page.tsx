/**
 * Reservations page
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { PlusIcon, CheckCircle2Icon } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { FilterPopover } from '@/components/search/filter-popover';
import { SortableHeader, type SortDirection } from '@/components/table/sortable-header';
import { ColumnSelector } from '@/components/table/column-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReservationDetailSheet } from '@/components/detail-sheets/reservation-detail-sheet';
import { collections } from '@/lib/pocketbase/client';
import { useFilters } from '@/hooks/use-filters';
import { useColumnVisibility } from '@/hooks/use-column-visibility';
import { reservationsFilterConfig } from '@/lib/filters/filter-configs';
import { reservationsColumnConfig } from '@/lib/tables/column-configs';
import type { ReservationExpanded } from '@/types';
import { formatDateTime } from '@/lib/utils/formatting';

export default function ReservationsPage() {
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

  const observerTarget = useRef<HTMLDivElement>(null);
  const perPage = 50;

  // Filter management
  const filters = useFilters({
    entity: 'reservations',
    config: reservationsFilterConfig,
  });

  // Sort management
  const [sortField, setSortField] = useState<string>(reservationsColumnConfig.defaultSort);
  const [sortColumn, setSortColumn] = useState<string | null>(null);

  // Column visibility management
  const columnVisibility = useColumnVisibility({
    entity: 'reservations',
    config: reservationsColumnConfig,
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
    setCurrentPage(1);
    fetchReservations(1);
  }, [debouncedSearch, fetchReservations]);

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
                      {columnVisibility.isColumnVisible('customer_name') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Kunde"
                            sortDirection={getSortDirection('customer_name')}
                            onSort={() => handleSort('customer_name')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('customer_phone') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Telefon"
                            sortDirection={getSortDirection('customer_phone')}
                            onSort={() => handleSort('customer_phone')}
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
                      {columnVisibility.isColumnVisible('pickup') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Abholung"
                            sortDirection={getSortDirection('pickup')}
                            onSort={() => handleSort('pickup')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('status') && (
                        <th className="px-4 py-2 text-left">
                          <button
                            onClick={() => handleSort('status')}
                            disabled={isLoading}
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                            title="Status"
                          >
                            <CheckCircle2Icon className="size-4" />
                          </button>
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('customer_email') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Email"
                            sortDirection={getSortDirection('customer_email')}
                            onSort={() => handleSort('customer_email')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('customer_iid') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Kunden-ID"
                            sortDirection={getSortDirection('customer_iid')}
                            onSort={() => handleSort('customer_iid')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('is_new_customer') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Neukunde"
                            sortDirection={getSortDirection('is_new_customer')}
                            onSort={() => handleSort('is_new_customer')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('comments') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Kommentare"
                            sortDirection={getSortDirection('comments')}
                            onSort={() => handleSort('comments')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((reservation) => (
                      <tr
                        key={reservation.id}
                        onClick={() => handleRowClick(reservation)}
                        className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        {columnVisibility.isColumnVisible('customer_name') && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {!reservation.is_new_customer && reservation.customer_iid && (
                                  <span className="font-mono text-primary mr-2">
                                    #{String(reservation.customer_iid).padStart(4, '0')}
                                  </span>
                                )}
                                {reservation.customer_name}
                              </span>
                              {reservation.is_new_customer && (
                                <Badge variant="outline">
                                  Neukunde
                                </Badge>
                              )}
                            </div>
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('customer_phone') && (
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {reservation.customer_phone || '—'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('items') && (
                          <td className="px-4 py-3 text-sm">
                            {reservation.expand?.items?.length > 0
                              ? reservation.expand.items.map((item) => item.name).join(', ')
                              : `${reservation.items.length} Gegenstände`}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('pickup') && (
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {formatDateTime(reservation.pickup)}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('status') && (
                          <td className="px-4 py-3">
                            <Badge variant={reservation.done ? 'default' : 'outline'}>
                              {reservation.done ? 'Erledigt' : 'Offen'}
                            </Badge>
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('customer_email') && (
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {reservation.customer_email || '—'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('customer_iid') && (
                          <td className="px-4 py-3 text-sm font-mono">
                            {reservation.customer_iid
                              ? String(reservation.customer_iid).padStart(4, '0')
                              : '—'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('is_new_customer') && (
                          <td className="px-4 py-3 text-sm">
                            {reservation.is_new_customer ? 'Ja' : 'Nein'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('comments') && (
                          <td className="px-4 py-3 text-sm">
                            {reservation.comments || '—'}
                          </td>
                        )}
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
      />
    </div>
  );
}
