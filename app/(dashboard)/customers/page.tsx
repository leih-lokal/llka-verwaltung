/**
 * Customers page
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PlusIcon, HeartIcon, CalendarCheckIcon, PackageIcon, HistoryIcon, MailIcon } from 'lucide-react';
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
import { cn } from '@/lib/utils';

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
  useRealtimeSubscription<Customer>('customer', {
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

  // Render table header cell for a given column
  const renderHeaderCell = (columnId: string) => {
    const dividerClass = columnVisibility.verticalDividers ? 'border-l first:border-l-0 border-border/30' : '';

    switch (columnId) {
      case 'iid':
        return (
          <th key="iid" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="ID"
              sortDirection={getSortDirection('iid')}
              onSort={() => handleSort('iid')}
              disabled={isLoading}
            />
          </th>
        );
      case 'name':
        return (
          <th key="name" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Name"
              sortDirection={getSortDirection('name')}
              onSort={() => handleSort('name')}
              disabled={isLoading}
            />
          </th>
        );
      case 'email':
        return (
          <th key="email" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Email"
              sortDirection={getSortDirection('email')}
              onSort={() => handleSort('email')}
              disabled={isLoading}
            />
          </th>
        );
      case 'phone':
        return (
          <th key="phone" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Telefon"
              sortDirection={getSortDirection('phone')}
              onSort={() => handleSort('phone')}
              disabled={isLoading}
            />
          </th>
        );
      case 'active_rentals':
        return (
          <th key="active_rentals" className={cn("px-4 py-2 text-left", dividerClass)} title="Aktive Ausleihen">
            <PackageIcon className="size-4" />
          </th>
        );
      case 'total_rentals':
        return (
          <th key="total_rentals" className={cn("px-4 py-2 text-left", dividerClass)} title="Gesamt Ausleihen">
            <HistoryIcon className="size-4" />
          </th>
        );
      case 'street':
        return (
          <th key="street" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Straße"
              sortDirection={getSortDirection('street')}
              onSort={() => handleSort('street')}
              disabled={isLoading}
            />
          </th>
        );
      case 'postal_code':
        return (
          <th key="postal_code" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="PLZ"
              sortDirection={getSortDirection('postal_code')}
              onSort={() => handleSort('postal_code')}
              disabled={isLoading}
            />
          </th>
        );
      case 'city':
        return (
          <th key="city" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Stadt"
              sortDirection={getSortDirection('city')}
              onSort={() => handleSort('city')}
              disabled={isLoading}
            />
          </th>
        );
      case 'registered_on':
        return (
          <th key="registered_on" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Registriert"
              sortDirection={getSortDirection('registered_on')}
              onSort={() => handleSort('registered_on')}
              disabled={isLoading}
            />
          </th>
        );
      case 'renewed_on':
        return (
          <th key="renewed_on" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Verlängert"
              sortDirection={getSortDirection('renewed_on')}
              onSort={() => handleSort('renewed_on')}
              disabled={isLoading}
            />
          </th>
        );
      case 'newsletter':
          return (
            <th key="newsletter" className={cn("px-4 py-2 text-left", dividerClass)} title="Newsletter">
              <SortableHeader
                label={<MailIcon className="size-4" />}
                sortDirection={getSortDirection('newsletter')}
                onSort={() => handleSort('newsletter')}
                disabled={isLoading}
              />
            </th>
          );
      case 'remark':
        return (
          <th key="remark" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Bemerkung"
              sortDirection={getSortDirection('remark')}
              onSort={() => handleSort('remark')}
              disabled={isLoading}
            />
          </th>
        );
      default:
        return null;
    }
  };

  // Render table body cell for a given column and customer
  const renderBodyCell = (columnId: string, customer: CustomerWithStats) => {
    const dividerClass = columnVisibility.verticalDividers ? 'border-l first:border-l-0 border-border/30' : '';

    switch (columnId) {
      case 'iid':
        return (
          <td key="iid" className={cn("px-4 py-3 font-mono text-sm", dividerClass)}>
            {String(customer.iid).padStart(4, '0')}
          </td>
        );
      case 'name':
        return (
          <td key="name" className={cn("px-4 py-3", dividerClass)}>
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
                      customer.highlight_color === 'blue' ? 'bg-blue-500' :
                      customer.highlight_color === 'purple' ? 'bg-purple-500' :
                      customer.highlight_color === 'orange' ? 'bg-orange-500' :
                      customer.highlight_color === 'pink' ? 'bg-pink-500' :
                      customer.highlight_color === 'teal' ? 'bg-teal-500' :
                      'bg-blue-500'
                    }`}
                    title={`Markiert: ${customer.highlight_color}`}
                  />
                )
              )}
              <span>{customer.firstname} {customer.lastname}</span>
            </div>
          </td>
        );
      case 'email':
        return (
          <td key="email" className={cn("px-4 py-3 text-sm text-muted-foreground", dividerClass)}>
            {customer.email || '—'}
          </td>
        );
      case 'phone':
        return (
          <td key="phone" className={cn("px-4 py-3 text-sm text-muted-foreground", dividerClass)}>
            {customer.phone || '—'}
          </td>
        );
      case 'active_rentals':
        return (
          <td key="active_rentals" className={cn("px-4 py-3 text-sm text-center", dividerClass)}>
            {isLoadingStats ? '—' : customer.active_rentals}
          </td>
        );
      case 'total_rentals':
        return (
          <td key="total_rentals" className={cn("px-4 py-3 text-sm text-center", dividerClass)}>
            {isLoadingStats ? '—' : customer.total_rentals}
          </td>
        );
      case 'street':
        return (
          <td key="street" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {customer.street || '—'}
          </td>
        );
      case 'postal_code':
        return (
          <td key="postal_code" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {customer.postal_code || '—'}
          </td>
        );
      case 'city':
        return (
          <td key="city" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {customer.city || '—'}
          </td>
        );
      case 'registered_on':
        return (
          <td key="registered_on" className={cn("px-4 py-3 text-sm text-muted-foreground", dividerClass)}>
            {new Date(customer.registered_on).toLocaleDateString('de-DE')}
          </td>
        );
      case 'renewed_on':
        return (
          <td key="renewed_on" className={cn("px-4 py-3 text-sm text-muted-foreground", dividerClass)}>
            {customer.renewed_on
              ? new Date(customer.renewed_on).toLocaleDateString('de-DE')
              : '—'}
          </td>
        );
      case 'newsletter':
        return (
          <td key="newsletter" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {customer.newsletter ? 'Ja' : 'Nein'}
          </td>
        );
      case 'remark':
        return (
          <td key="remark" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {customer.remark || '—'}
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
                    {columnVisibility.getOrderedColumns(true).map(renderHeaderCell)}
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
                              customer.highlight_color === 'blue' ? 'border-b-blue-500' :
                              customer.highlight_color === 'purple' ? 'border-b-purple-500' :
                              customer.highlight_color === 'orange' ? 'border-b-orange-500' :
                              customer.highlight_color === 'pink' ? 'border-b-pink-500' :
                              customer.highlight_color === 'teal' ? 'border-b-teal-500' :
                              'border-b-blue-500'
                            }`
                          : 'border-b'
                      }`}
                    >
                      {columnVisibility.getOrderedColumns(true).map((columnId) => renderBodyCell(columnId, customer))}
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
