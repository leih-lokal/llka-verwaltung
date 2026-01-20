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
import type { Item, ItemWithStats } from '@/types';
import { getItemStatusLabel, ITEM_STATUS_COLORS } from '@/lib/constants/statuses';
import { getCategoryLabel } from '@/lib/constants/categories';
import { enrichItemsWithStats } from '@/lib/utils/item-stats';
import { cn } from '@/lib/utils';
import { FormattedId } from '@/components/ui/formatted-id';

export default function ItemsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<ItemWithStats[]>([]);
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
    defaultFilters: [
      {
        type: 'status',
        field: 'status',
        operator: '!=',
        value: 'deleted',
        label: 'Status: NICHT Gelöscht',
        exclude: true,
      },
    ],
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
    onCreated: async (item) => {
      // Enrich the new item with stats
      const enriched = await enrichItemsWithStats([item]);
      setItems((prev) => {
        // Check if item already exists (avoid duplicates)
        if (prev.some((i) => i.id === item.id)) {
          return prev;
        }
        // Add to beginning of list
        return [enriched[0], ...prev];
      });
    },
    onUpdated: async (item) => {
      // Enrich the updated item with stats
      const enriched = await enrichItemsWithStats([item]);
      // Update item in list
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? enriched[0] : i))
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

      // Enrich items with rental statistics
      const enrichedItems = await enrichItemsWithStats(result.items);

      if (isInitialLoad) {
        setItems(enrichedItems);
      } else {
        setItems((prev) => [...prev, ...enrichedItems]);
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
      case 'images':
        return (
          <th key="images" className={cn("px-4 py-2 text-left", dividerClass)}>
            <span className="text-sm font-medium">Bild</span>
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
      case 'brand':
        return (
          <th key="brand" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Marke"
              sortDirection={getSortDirection('brand')}
              onSort={() => handleSort('brand')}
              disabled={isLoading}
            />
          </th>
        );
      case 'model':
        return (
          <th key="model" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Modell"
              sortDirection={getSortDirection('model')}
              onSort={() => handleSort('model')}
              disabled={isLoading}
            />
          </th>
        );
      case 'category':
        return (
          <th key="category" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Kategorie"
              sortDirection={getSortDirection('category')}
              onSort={() => handleSort('category')}
              disabled={isLoading}
            />
          </th>
        );
      case 'status':
        return (
          <th key="status" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Status"
              sortDirection={getSortDirection('status')}
              onSort={() => handleSort('status')}
              disabled={isLoading}
            />
          </th>
        );
      case 'deposit':
        return (
          <th key="deposit" className={cn("px-4 py-2 text-left", dividerClass)}>
            <button
              onClick={() => handleSort('deposit')}
              disabled={isLoading}
              className="flex items-center gap-1 hover:text-primary transition-colors"
              title="Kaution/Tara"
            >
              <CoinsIcon className="size-4" />
            </button>
          </th>
        );
      case 'msrp':
        return (
          <th key="msrp" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="UVP"
              sortDirection={getSortDirection('msrp')}
              onSort={() => handleSort('msrp')}
              disabled={isLoading}
            />
          </th>
        );
      case 'description':
        return (
          <th key="description" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Beschreibung"
              sortDirection={getSortDirection('description')}
              onSort={() => handleSort('description')}
              disabled={isLoading}
            />
          </th>
        );
      case 'packaging':
        return (
          <th key="packaging" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Verpackung"
              sortDirection={getSortDirection('packaging')}
              onSort={() => handleSort('packaging')}
              disabled={isLoading}
            />
          </th>
        );
      case 'manual':
        return (
          <th key="manual" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Anleitung"
              sortDirection={getSortDirection('manual')}
              onSort={() => handleSort('manual')}
              disabled={isLoading}
            />
          </th>
        );
      case 'parts':
        return (
          <th key="parts" className={cn("px-4 py-2 text-left", dividerClass)}>
            <button
              onClick={() => handleSort('parts')}
              disabled={isLoading}
              className="flex items-center gap-1 hover:text-primary transition-colors"
              title="Teile"
            >
              <WrenchIcon className="size-4" />
            </button>
          </th>
        );
      case 'copies':
        return (
          <th key="copies" className={cn("px-4 py-2 text-left", dividerClass)}>
            <button
              onClick={() => handleSort('copies')}
              disabled={isLoading}
              className="flex items-center gap-1 hover:text-primary transition-colors"
              title="Exemplare"
            >
              <CopyIcon className="size-4" />
            </button>
          </th>
        );
      case 'total_rentals':
        return (
          <th key="total_rentals" className={cn("px-4 py-2 text-left", dividerClass)} title="Gesamt Ausleihen">
            <HistoryIcon className="size-4" />
          </th>
        );
      case 'internal_note':
        return (
          <th key="internal_note" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Interne Notiz"
              sortDirection={getSortDirection('internal_note')}
              onSort={() => handleSort('internal_note')}
              disabled={isLoading}
            />
          </th>
        );
      case 'added_on':
        return (
          <th key="added_on" className={cn("px-4 py-2 text-left", dividerClass)}>
            <SortableHeader
              label="Hinzugefügt"
              sortDirection={getSortDirection('added_on')}
              onSort={() => handleSort('added_on')}
              disabled={isLoading}
            />
          </th>
        );
      default:
        return null;
    }
  };

  // Render table body cell for a given column and item
  const renderBodyCell = (columnId: string, item: ItemWithStats) => {
    const dividerClass = columnVisibility.verticalDividers ? 'border-l first:border-l-0 border-border/30' : '';

    switch (columnId) {
      case 'iid':
        return (
          <td key="iid" className={cn("px-4 py-3", dividerClass)}>
            <FormattedId id={item.iid} size="lg" />
          </td>
        );
      case 'images':
        return (
          <td key="images" className={cn("px-4 py-3", dividerClass)} onClick={(e) => e.stopPropagation()}>
            {item.images && item.images.length > 0 ? (
              <HoverCard openDelay={200}>
                <HoverCardTrigger asChild>
                  <div className="w-10 h-10 rounded overflow-hidden border border-border cursor-pointer">
                    <img
                      src={pb.files.getURL(item, item.images[0], { thumb: '40x40f' })}
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
                    src={pb.files.getURL(item, item.images[0], { thumb: '512x512f' })}
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
        );
      case 'name':
        return (
          <td key="name" className={cn("px-4 py-3 font-medium", dividerClass)}>
            <div className="flex items-center gap-2">
              {item.highlight_color && (
                item.highlight_color === 'green' ? (
                  <HeartIcon className="size-4 fill-green-500 text-green-500" />
                ) : (
                  <div className={`size-3 rounded-full ${
                    item.highlight_color === 'red' ? 'bg-red-500' :
                    item.highlight_color === 'yellow' ? 'bg-yellow-500' :
                    item.highlight_color === 'blue' ? 'bg-blue-500' :
                    item.highlight_color === 'purple' ? 'bg-purple-500' :
                    item.highlight_color === 'orange' ? 'bg-orange-500' :
                    item.highlight_color === 'pink' ? 'bg-pink-500' :
                    item.highlight_color === 'teal' ? 'bg-teal-500' :
                    'bg-blue-500'
                  }`} />
                )
              )}
              <span>{item.name}</span>
            </div>
          </td>
        );
      case 'brand':
        return (
          <td key="brand" className={cn("px-4 py-3 text-sm text-muted-foreground", dividerClass)}>
            {item.brand || '—'}
          </td>
        );
      case 'model':
        return (
          <td key="model" className={cn("px-4 py-3 text-sm text-muted-foreground", dividerClass)}>
            {item.model || '—'}
          </td>
        );
      case 'category':
        return (
          <td key="category" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {item.category.length > 0
              ? item.category.map(getCategoryLabel).join(', ')
              : '—'}
          </td>
        );
      case 'status':
        return (
          <td key="status" className={cn("px-4 py-3", dividerClass)}>
            <Badge variant={ITEM_STATUS_COLORS[item.status]}>
              {getItemStatusLabel(item.status)}
            </Badge>
          </td>
        );
      case 'deposit':
        return (
          <td key="deposit" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {item.deposit > 0 ? `${item.deposit} €` : '—'}
          </td>
        );
      case 'msrp':
        return (
          <td key="msrp" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {item.msrp && item.msrp > 0 ? `${item.msrp} €` : '—'}
          </td>
        );
      case 'description':
        return (
          <td key="description" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {item.description || '—'}
          </td>
        );
      case 'packaging':
        return (
          <td key="packaging" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {item.packaging || '—'}
          </td>
        );
      case 'manual':
        return (
          <td key="manual" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {item.manual || '—'}
          </td>
        );
      case 'parts':
        return (
          <td key="parts" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {item.parts || '—'}
          </td>
        );
      case 'copies':
        return (
          <td key="copies" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {item.copies}
          </td>
        );
      case 'total_rentals':
        return (
          <td key="total_rentals" className={cn("px-4 py-3 text-sm text-center", dividerClass)}>
            {item.total_rentals || 0}
          </td>
        );
      case 'internal_note':
        return (
          <td key="internal_note" className={cn("px-4 py-3 text-sm", dividerClass)}>
            {item.internal_note || '—'}
          </td>
        );
      case 'added_on':
        return (
          <td key="added_on" className={cn("px-4 py-3 text-sm text-muted-foreground", dividerClass)}>
            {new Date(item.added_on).toLocaleDateString('de-DE')}
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
                  {columnVisibility.getOrderedColumns(true).map(renderHeaderCell)}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleRowClick(item)}
                    className={`border-b hover:bg-muted/50 transition-colors cursor-pointer ${
                      item.status !== 'instock' ? 'text-muted-foreground bg-muted' : ''
                    }`}
                  >
                    {columnVisibility.getOrderedColumns(true).map((columnId) => renderBodyCell(columnId, item))}
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
