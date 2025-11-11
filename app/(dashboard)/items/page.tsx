/**
 * Items page
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PlusIcon, ImageIcon, CoinsIcon, WrenchIcon, CopyIcon, HistoryIcon, HeartIcon } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { FilterPopover } from '@/components/search/filter-popover';
import { SortableHeader, type SortDirection } from '@/components/table/sortable-header';
import { ColumnSelector } from '@/components/table/column-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { ItemDetailSheet } from '@/components/detail-sheets/item-detail-sheet';
import { collections, pb } from '@/lib/pocketbase/client';
import { useFilters } from '@/hooks/use-filters';
import { useColumnVisibility } from '@/hooks/use-column-visibility';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import { itemsFilterConfig } from '@/lib/filters/filter-configs';
import { itemsColumnConfig } from '@/lib/tables/column-configs';
import type { Item } from '@/types';
import { getItemStatusLabel, ITEM_STATUS_COLORS } from '@/lib/constants/statuses';
import { getCategoryLabel } from '@/lib/constants/categories';

export default function ItemsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const observerTarget = useRef<HTMLDivElement>(null);
  const perPage = 50;

  // Filter management
  const filters = useFilters({
    entity: 'items',
    config: itemsFilterConfig,
  });

  // Sort management
  const [sortField, setSortField] = useState<string>(itemsColumnConfig.defaultSort);
  const [sortColumn, setSortColumn] = useState<string | null>(null);

  // Column visibility management
  const columnVisibility = useColumnVisibility({
    entity: 'items',
    config: itemsColumnConfig,
  });

  // Real-time subscription for live updates
  useRealtimeSubscription<Item>('item', {
    onCreated: (item) => {
      setItems((prev) => {
        // Check if item already exists (avoid duplicates)
        if (prev.some((i) => i.id === item.id)) {
          return prev;
        }
        // Add to beginning of list
        return [item, ...prev];
      });
    },
    onUpdated: (item) => {
      // Update item in list
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? item : i))
      );
    },
    onDeleted: (item) => {
      // Remove from list
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    },
  });

  // Handle URL query parameters (action=new or view=id)
  useEffect(() => {
    const action = searchParams.get('action');
    const viewId = searchParams.get('view');

    if (action === 'new') {
      setSelectedItem(null);
      setIsSheetOpen(true);
      // Clear the URL parameter
      router.replace('/items');
    } else if (viewId) {
      // Fetch the item by ID and open it
      collections.items().getOne<Item>(viewId).then((item) => {
        setSelectedItem(item);
        setIsSheetOpen(true);
        // Clear the URL parameter
        router.replace('/items');
      }).catch((err) => {
        console.error('Failed to load item:', err);
        router.replace('/items');
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
    setItems([]);
    setCurrentPage(1);
    setHasMore(true);
  }, [debouncedSearch, filters.activeFilters, sortField]);

  const fetchItems = useCallback(async (page: number) => {
    try {
      const isInitialLoad = page === 1;
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      // Build server-side filter from search and active filters
      const filter = filters.buildFilter(debouncedSearch);

      const result = await collections.items().getList<Item>(
        page,
        perPage,
        {
          sort: sortField,
          filter,
          skipTotal: true,
        }
      );

      if (isInitialLoad) {
        setItems(result.items);
      } else {
        setItems((prev) => [...prev, ...result.items]);
      }

      setHasMore(result.items.length === perPage);
      setCurrentPage(page + 1);
      setError(null);
    } catch (err) {
      console.error('Error fetching items:', err);
      setError(
        err instanceof Error ? err.message : 'Fehler beim Laden der Gegenstände'
      );
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [debouncedSearch, filters.buildFilter, sortField, perPage]);

  // Initial load and reload on search change
  useEffect(() => {
    setCurrentPage(1);
    fetchItems(1);
  }, [debouncedSearch, fetchItems]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          fetchItems(currentPage);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [fetchItems, currentPage, hasMore, isLoading, isLoadingMore]);

  // Handle column sort
  const handleSort = (columnId: string) => {
    const column = itemsColumnConfig.columns.find((c) => c.id === columnId);
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
    const column = itemsColumnConfig.columns.find((c) => c.id === columnId);
    const field = column?.sortField || columnId;
    return sortField === field ? 'asc' : sortField === `-${field}` ? 'desc' : null;
  };

  // Handle row click to open detail sheet
  const handleRowClick = (item: Item) => {
    setSelectedItem(item);
    setIsSheetOpen(true);
  };

  // Handle new item button
  const handleNewItem = () => {
    setSelectedItem(null);
    setIsSheetOpen(true);
  };

  // Handle item save
  const handleItemSave = (savedItem: Item) => {
    // Refresh the list
    setItems([]);
    setCurrentPage(1);
    fetchItems(1);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b-2 border-primary bg-background p-4">
        <div className="flex gap-2">
          <Button onClick={handleNewItem} size="sm" className="h-10">
            <PlusIcon className="size-4 mr-2" />
            Neu
          </Button>
          <FilterPopover
            open={filters.isFilterPopoverOpen}
            onOpenChange={filters.setIsFilterPopoverOpen}
            statusFilters={itemsFilterConfig.statusFilters}
            dateFilters={itemsFilterConfig.dateFilters}
            categoryFilters={itemsFilterConfig.categoryFilters}
            numericFilters={itemsFilterConfig.numericFilters}
            activeFilters={filters.activeFilters}
            onAddFilter={filters.addFilter}
            onRemoveFilter={filters.removeFilter}
            onClearAll={filters.clearAllFilters}
          >
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Gegenstände suchen..."
                disabled={isLoading}
                filters={filters.activeFilters}
                onRemoveFilter={filters.removeFilter}
                onFilterClick={filters.toggleFilterPopover}
                filterCount={filters.filterCount}
              />
            </div>
          </FilterPopover>
          <ColumnSelector
            columns={itemsColumnConfig.columns}
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
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {debouncedSearch ? 'Keine Ergebnisse gefunden' : 'Keine Gegenstände gefunden'}
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
                      {columnVisibility.isColumnVisible('images') && (
                        <th className="px-4 py-2 text-left">
                          <span className="text-sm font-medium">Bild</span>
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
                      {columnVisibility.isColumnVisible('brand') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Marke"
                            sortDirection={getSortDirection('brand')}
                            onSort={() => handleSort('brand')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('model') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Modell"
                            sortDirection={getSortDirection('model')}
                            onSort={() => handleSort('model')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('category') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Kategorie"
                            sortDirection={getSortDirection('category')}
                            onSort={() => handleSort('category')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('status') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Status"
                            sortDirection={getSortDirection('status')}
                            onSort={() => handleSort('status')}
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
                            title="Kaution/Tara"
                          >
                            <CoinsIcon className="size-4" />
                          </button>
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('description') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Beschreibung"
                            sortDirection={getSortDirection('description')}
                            onSort={() => handleSort('description')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('packaging') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Verpackung"
                            sortDirection={getSortDirection('packaging')}
                            onSort={() => handleSort('packaging')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('manual') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Anleitung"
                            sortDirection={getSortDirection('manual')}
                            onSort={() => handleSort('manual')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('parts') && (
                        <th className="px-4 py-2 text-left">
                          <button
                            onClick={() => handleSort('parts')}
                            disabled={isLoading}
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                            title="Teile"
                          >
                            <WrenchIcon className="size-4" />
                          </button>
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('copies') && (
                        <th className="px-4 py-2 text-left">
                          <button
                            onClick={() => handleSort('copies')}
                            disabled={isLoading}
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                            title="Exemplare"
                          >
                            <CopyIcon className="size-4" />
                          </button>
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('total_rentals') && (
                        <th className="px-4 py-2 text-left" title="Gesamt Ausleihen">
                          <HistoryIcon className="size-4" />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('internal_note') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Interne Notiz"
                            sortDirection={getSortDirection('internal_note')}
                            onSort={() => handleSort('internal_note')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                      {columnVisibility.isColumnVisible('added_on') && (
                        <th className="px-4 py-2 text-left">
                          <SortableHeader
                            label="Hinzugefügt"
                            sortDirection={getSortDirection('added_on')}
                            onSort={() => handleSort('added_on')}
                            disabled={isLoading}
                          />
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => handleRowClick(item)}
                        className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        {columnVisibility.isColumnVisible('iid') && (
                          <td className="px-4 py-3 font-mono text-sm">
                            <div className="flex items-center gap-1">
                              <span className="inline-flex items-center justify-center bg-red-500 text-white font-bold px-1.5 py-0.5 rounded text-xs">
                                {String(item.iid).padStart(4, '0').substring(0, 2)}
                              </span>
                              <span>{String(item.iid).padStart(4, '0').substring(2, 4)}</span>
                            </div>
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('images') && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {item.images && item.images.length > 0 ? (
                              <HoverCard openDelay={200}>
                                <HoverCardTrigger asChild>
                                  <div className="w-10 h-10 rounded overflow-hidden border border-border cursor-pointer">
                                    <img
                                      src={pb.files.getURL(item, item.images[0], { thumb: '40x40' })}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      decoding="async"
                                      width={40}
                                      height={40}
                                    />
                                  </div>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80 p-2">
                                  <img
                                    src={pb.files.getURL(item, item.images[0], { thumb: '300x300' })}
                                    alt={item.name}
                                    className="w-full h-auto rounded"
                                    loading="lazy"
                                    decoding="async"
                                    width={300}
                                    height={300}
                                  />
                                  {item.images.length > 1 && (
                                    <p className="text-xs text-muted-foreground mt-2 text-center">
                                      +{item.images.length - 1} weitere{item.images.length - 1 === 1 ? 's' : ''} Bild{item.images.length - 1 === 1 ? '' : 'er'}
                                    </p>
                                  )}
                                </HoverCardContent>
                              </HoverCard>
                            ) : (
                              <div className="w-10 h-10 rounded border border-dashed border-border flex items-center justify-center bg-muted/20">
                                <ImageIcon className="size-4 text-muted-foreground" />
                              </div>
                            )}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('name') && (
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-2">
                              {item.highlight_color && (
                                item.highlight_color === 'green' ? (
                                  <HeartIcon className="size-4 fill-green-500 text-green-500" />
                                ) : (
                                  <div className={`size-3 rounded-full ${
                                    item.highlight_color === 'red' ? 'bg-red-500' :
                                    item.highlight_color === 'yellow' ? 'bg-yellow-500' :
                                    'bg-blue-500'
                                  }`} />
                                )
                              )}
                              <span>{item.name}</span>
                            </div>
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('brand') && (
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {item.brand || '—'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('model') && (
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {item.model || '—'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('category') && (
                          <td className="px-4 py-3 text-sm">
                            {item.category.length > 0
                              ? item.category.map(getCategoryLabel).join(', ')
                              : '—'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('status') && (
                          <td className="px-4 py-3">
                            <Badge variant={ITEM_STATUS_COLORS[item.status]}>
                              {getItemStatusLabel(item.status)}
                            </Badge>
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('deposit') && (
                          <td className="px-4 py-3 text-sm">
                            {item.deposit > 0 ? `${item.deposit} €` : '—'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('description') && (
                          <td className="px-4 py-3 text-sm">
                            {item.description || '—'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('packaging') && (
                          <td className="px-4 py-3 text-sm">
                            {item.packaging || '—'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('manual') && (
                          <td className="px-4 py-3 text-sm">
                            {item.manual || '—'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('parts') && (
                          <td className="px-4 py-3 text-sm">
                            {item.parts || '—'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('copies') && (
                          <td className="px-4 py-3 text-sm">
                            {item.copies}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('total_rentals') && (
                          <td className="px-4 py-3 text-sm text-center">
                            {/* TODO: Compute total rentals count */}
                            —
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('internal_note') && (
                          <td className="px-4 py-3 text-sm">
                            {item.internal_note || '—'}
                          </td>
                        )}
                        {columnVisibility.isColumnVisible('added_on') && (
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {new Date(item.added_on).toLocaleDateString('de-DE')}
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
            {!hasMore && items.length > 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Alle Gegenstände geladen
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Item Detail Sheet */}
      <ItemDetailSheet
        item={selectedItem}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onSave={handleItemSave}
      />
    </div>
  );
}
