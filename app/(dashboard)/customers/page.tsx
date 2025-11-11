/**
 * Customers page
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PlusIcon, HeartIcon, CalendarCheckIcon, PackageIcon, HistoryIcon } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { FilterPopover } from '@/components/search/filter-popover';
import { SortableHeader, type SortDirection } from '@/components/table/sortable-header';
import { ColumnSelector } from '@/components/table/column-selector';
import { Button } from '@/components/ui/button';
import { CustomerDetailSheet } from '@/components/detail-sheets/customer-detail-sheet';
import { collections } from '@/lib/pocketbase/client';
import { useFilters } from '@/hooks/use-filters';
import { useColumnVisibility } from '@/hooks/use-column-visibility';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import { customersFilterConfig } from '@/lib/filters/filter-configs';
import { customersColumnConfig } from '@/lib/tables/column-configs';
import { enrichCustomersWithStats } from '@/lib/utils/customer-stats';
import type { Customer, CustomerWithStats } from '@/types';

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const observerTarget = useRef<HTMLDivElement>(null);
  const perPage = 50;

  // Filter management
  const filters = useFilters({
    entity: 'customers',
    config: customersFilterConfig,
  });

  // Sort management
  const [sortField, setSortField] = useState<string>(customersColumnConfig.defaultSort);
  const [sortColumn, setSortColumn] = useState<string | null>(null);

  // Column visibility management
  const columnVisibility = useColumnVisibility({
    entity: 'customers',
    config: customersColumnConfig,
  });

  // Real-time subscription for live updates
  useRealtimeSubscription<Customer>('customers', {
    onCreated: async (customer) => {
      // Enrich with stats and add to list
      const enriched = await enrichCustomersWithStats([customer]);
      if (enriched.length > 0) {
        setCustomers((prev) => {
          // Check if customer already exists (avoid duplicates)
          if (prev.some((c) => c.id === customer.id)) {
            return prev;
          }
          // Add to beginning of list
          return [enriched[0], ...prev];
        });
      }
    },
    onUpdated: async (customer) => {
      // Enrich with stats and update in list
      const enriched = await enrichCustomersWithStats([customer]);
      if (enriched.length > 0) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === customer.id ? enriched[0] : c))
        );
      }
    },
    onDeleted: (customer) => {
      // Remove from list
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
    },
  });

  // Handle URL query parameters (action=new or view=id)
  useEffect(() => {
    const action = searchParams.get('action');
    const viewId = searchParams.get('view');

    if (action === 'new') {
      setSelectedCustomer(null);
      setIsSheetOpen(true);
      // Clear the URL parameter
      router.replace('/customers');
    } else if (viewId) {
      // Fetch the customer by ID and open it
      collections.customers().getOne<Customer>(viewId).then((customer) => {
        setSelectedCustomer(customer);
        setIsSheetOpen(true);
        // Clear the URL parameter
        router.replace('/customers');
      }).catch((err) => {
        console.error('Failed to load customer:', err);
        router.replace('/customers');
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
    setCustomers([]);
    setCurrentPage(1);
    setHasMore(true);
  }, [debouncedSearch, filters.activeFilters, sortField]);

  const fetchCustomers = useCallback(async (page: number) => {
    try {
      const isInitialLoad = page === 1;
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      // Build server-side filter from search and active filters
      const filter = filters.buildFilter(debouncedSearch);

      const result = await collections.customers().getList<Customer>(
        page,
        perPage,
        {
          sort: sortField,
          filter,
          skipTotal: true, // Performance optimization
        }
      );

      // Enrich customers with stats
      setIsLoadingStats(true);
      const enrichedCustomers = await enrichCustomersWithStats(result.items);
      setIsLoadingStats(false);

      if (isInitialLoad) {
        setCustomers(enrichedCustomers);
      } else {
        setCustomers((prev) => [...prev, ...enrichedCustomers]);
      }

      setHasMore(result.items.length === perPage);
      setCurrentPage(page + 1);
      setError(null);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(
        err instanceof Error ? err.message : 'Fehler beim Laden der Kund:innen'
      );
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsLoadingStats(false);
    }
  }, [debouncedSearch, filters.buildFilter, sortField, perPage]);

  // Initial load and reload on search change
  useEffect(() => {
    setCurrentPage(1);
    fetchCustomers(1);
  }, [debouncedSearch, fetchCustomers]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          fetchCustomers(currentPage);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [fetchCustomers, currentPage, hasMore, isLoading, isLoadingMore]);

  // Handle column sort
  const handleSort = (columnId: string) => {
    const column = customersColumnConfig.columns.find((c) => c.id === columnId);
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
    const column = customersColumnConfig.columns.find((c) => c.id === columnId);
    const field = column?.sortField || columnId;
    return sortField === field ? 'asc' : sortField === `-${field}` ? 'desc' : null;
  };

  // Handle row click to open detail sheet
  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsSheetOpen(true);
  };

  // Handle new customer button
  const handleNewCustomer = () => {
    setSelectedCustomer(null);
    setIsSheetOpen(true);
  };

  // Handle customer save
  const handleCustomerSave = (savedCustomer: Customer) => {
    // Refresh the list
    setCustomers([]);
    setCurrentPage(1);
    fetchCustomers(1);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b-2 border-primary bg-background p-4">
        <div className="flex gap-2">
          <Button onClick={handleNewCustomer} size="sm" className="h-10">
            <PlusIcon className="size-4 mr-2" />
            Neu
          </Button>
          <FilterPopover
            open={filters.isFilterPopoverOpen}
            onOpenChange={filters.setIsFilterPopoverOpen}
            dateFilters={customersFilterConfig.dateFilters}
            categoryFilters={customersFilterConfig.categoryFilters}
            activeFilters={filters.activeFilters}
            onAddFilter={filters.addFilter}
            onRemoveFilter={filters.removeFilter}
            onClearAll={filters.clearAllFilters}
          >
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Kund:innen suchen..."
                disabled={isLoading}
                filters={filters.activeFilters}
                onRemoveFilter={filters.removeFilter}
                onFilterClick={filters.toggleFilterPopover}
                filterCount={filters.filterCount}
              />
            </div>
          </FilterPopover>
          <ColumnSelector
            columns={customersColumnConfig.columns}
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
          ) : customers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {debouncedSearch ? 'Keine Ergebnisse gefunden' : 'Keine Kund:innen gefunden'}
              </p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-primary">
                    {columnVisibility.isColumnVisible('iid') && (
                      <th className="px-4 py-2 text-left">
                        <SortableHeader
                          label="ID"
                          sortDirection={getSortDirection('iid')}
                          onSort={() => handleSort('iid')}
                          disabled={isLoading}
                        />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('name') && (
                      <th className="px-4 py-2 text-left">
                        <SortableHeader
                          label="Name"
                          sortDirection={getSortDirection('name')}
                          onSort={() => handleSort('name')}
                          disabled={isLoading}
                        />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('email') && (
                      <th className="px-4 py-2 text-left">
                        <SortableHeader
                          label="Email"
                          sortDirection={getSortDirection('email')}
                          onSort={() => handleSort('email')}
                          disabled={isLoading}
                        />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('phone') && (
                      <th className="px-4 py-2 text-left">
                        <SortableHeader
                          label="Telefon"
                          sortDirection={getSortDirection('phone')}
                          onSort={() => handleSort('phone')}
                          disabled={isLoading}
                        />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('active_reservations') && (
                      <th className="px-4 py-2 text-left" title="Aktive Reservierungen">
                        <CalendarCheckIcon className="size-4" />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('active_rentals') && (
                      <th className="px-4 py-2 text-left" title="Aktive Ausleihen">
                        <PackageIcon className="size-4" />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('total_rentals') && (
                      <th className="px-4 py-2 text-left" title="Gesamt Ausleihen">
                        <HistoryIcon className="size-4" />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('street') && (
                      <th className="px-4 py-2 text-left">
                        <SortableHeader
                          label="Straße"
                          sortDirection={getSortDirection('street')}
                          onSort={() => handleSort('street')}
                          disabled={isLoading}
                        />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('postal_code') && (
                      <th className="px-4 py-2 text-left">
                        <SortableHeader
                          label="PLZ"
                          sortDirection={getSortDirection('postal_code')}
                          onSort={() => handleSort('postal_code')}
                          disabled={isLoading}
                        />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('city') && (
                      <th className="px-4 py-2 text-left">
                        <SortableHeader
                          label="Stadt"
                          sortDirection={getSortDirection('city')}
                          onSort={() => handleSort('city')}
                          disabled={isLoading}
                        />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('registered_on') && (
                      <th className="px-4 py-2 text-left">
                        <SortableHeader
                          label="Registriert"
                          sortDirection={getSortDirection('registered_on')}
                          onSort={() => handleSort('registered_on')}
                          disabled={isLoading}
                        />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('renewed_on') && (
                      <th className="px-4 py-2 text-left">
                        <SortableHeader
                          label="Verlängert"
                          sortDirection={getSortDirection('renewed_on')}
                          onSort={() => handleSort('renewed_on')}
                          disabled={isLoading}
                        />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('heard') && (
                      <th className="px-4 py-2 text-left">
                        <SortableHeader
                          label="Gehört über"
                          sortDirection={getSortDirection('heard')}
                          onSort={() => handleSort('heard')}
                          disabled={isLoading}
                        />
                      </th>
                    )}
                    {columnVisibility.isColumnVisible('newsletter') && (
                      <th className="px-4 py-2 text-left">
                        <SortableHeader
                          label="Newsletter"
                          sortDirection={getSortDirection('newsletter')}
                          onSort={() => handleSort('newsletter')}
                          disabled={isLoading}
                        />
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
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => handleRowClick(customer)}
                      className={`hover:bg-muted/50 transition-colors cursor-pointer ${
                        customer.highlight_color && customer.highlight_color !== 'green'
                          ? `border-b-4 ${
                              customer.highlight_color === 'red' ? 'border-b-red-500' :
                              customer.highlight_color === 'yellow' ? 'border-b-yellow-500' :
                              'border-b-blue-500'
                            }`
                          : 'border-b'
                      }`}
                    >
                      {columnVisibility.isColumnVisible('iid') && (
                        <td className="px-4 py-3 font-mono text-sm">
                          {String(customer.iid).padStart(4, '0')}
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('name') && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {customer.highlight_color && (
                              customer.highlight_color === 'green' ? (
                                <span title="Teil des Teams">
                                  <HeartIcon
                                    className="size-4 fill-green-500 text-green-500 shrink-0"
                                  />
                                </span>
                              ) : (
                                <div
                                  className={`size-3 rounded-full shrink-0 ${
                                    customer.highlight_color === 'red' ? 'bg-red-500' :
                                    customer.highlight_color === 'yellow' ? 'bg-yellow-500' :
                                    'bg-blue-500'
                                  }`}
                                  title={`Markiert: ${customer.highlight_color}`}
                                />
                              )
                            )}
                            <span>{customer.firstname} {customer.lastname}</span>
                          </div>
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('email') && (
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {customer.email || '—'}
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('phone') && (
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {customer.phone || '—'}
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('active_rentals') && (
                        <td className="px-4 py-3 text-sm text-center">
                          {isLoadingStats ? '—' : customer.active_rentals}
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('total_rentals') && (
                        <td className="px-4 py-3 text-sm text-center">
                          {isLoadingStats ? '—' : customer.total_rentals}
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('street') && (
                        <td className="px-4 py-3 text-sm">
                          {customer.street || '—'}
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('postal_code') && (
                        <td className="px-4 py-3 text-sm">
                          {customer.postal_code || '—'}
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('city') && (
                        <td className="px-4 py-3 text-sm">
                          {customer.city || '—'}
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('registered_on') && (
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(customer.registered_on).toLocaleDateString(
                            'de-DE'
                          )}
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('renewed_on') && (
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {customer.renewed_on
                            ? new Date(customer.renewed_on).toLocaleDateString('de-DE')
                            : '—'}
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('heard') && (
                        <td className="px-4 py-3 text-sm">
                          {customer.heard || '—'}
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('newsletter') && (
                        <td className="px-4 py-3 text-sm">
                          {customer.newsletter ? 'Ja' : 'Nein'}
                        </td>
                      )}
                      {columnVisibility.isColumnVisible('remark') && (
                        <td className="px-4 py-3 text-sm">
                          {customer.remark || '—'}
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
              {!hasMore && customers.length > 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    Alle Kund:innen geladen
                  </p>
                </div>
              )}
            </>
          )}
      </div>

      {/* Customer Detail Sheet */}
      <CustomerDetailSheet
        customer={selectedCustomer}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onSave={handleCustomerSave}
      />
    </div>
  );
}
