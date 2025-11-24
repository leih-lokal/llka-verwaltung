/**
 * Logs page
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { FileText, Eye, EyeOff } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { FilterPopover } from '@/components/search/filter-popover';
import { SortableHeader, type SortDirection } from '@/components/table/sortable-header';
import { ColumnSelector } from '@/components/table/column-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { pb } from '@/lib/pocketbase/client';
import { LogPrettyView, LogRawView } from '@/components/logs/log-pretty-view';
import { isRestRequest } from '@/lib/utils/log-parser';
import { useFilters } from '@/hooks/use-filters';
import { useColumnVisibility } from '@/hooks/use-column-visibility';
import { logsFilterConfig } from '@/lib/filters/filter-configs';
import { logsColumnConfig } from '@/lib/tables/column-configs';
import { formatDateTime } from '@/lib/utils/formatting';
import type { LogEntry, LogEntryRaw, LogLevelString } from '@/types';

/**
 * Convert numeric log level to string
 */
function normalizeLogLevel(level: number): LogLevelString {
  switch (level) {
    case 0:
      return 'info';
    case 4:
      return 'warn';
    case 8:
      return 'error';
    default:
      // Default to info for unknown levels
      return 'info';
  }
}

/**
 * Convert raw log entry from PocketBase to normalized format
 */
function normalizeLogEntry(raw: LogEntryRaw): LogEntry {
  return {
    ...raw,
    level: normalizeLogLevel(raw.level),
  };
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pretty view state
  const [showPrettyView, setShowPrettyView] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const observerTarget = useRef<HTMLDivElement>(null);
  const perPage = 50;

  // Load pretty view preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('logs_pretty_view');
    if (stored !== null) {
      setShowPrettyView(stored === 'true');
    }
  }, []);

  // Save pretty view preference to localStorage
  useEffect(() => {
    localStorage.setItem('logs_pretty_view', String(showPrettyView));
  }, [showPrettyView]);

  // Toggle global pretty view
  const toggleGlobalView = useCallback(() => {
    setShowPrettyView(prev => !prev);
    // Clear per-row overrides when toggling global
    setExpandedLogs(new Set());
  }, []);

  // Toggle individual log view
  const toggleLogView = useCallback((logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }, []);

  // Determine if a specific log should show pretty view
  const shouldShowPretty = useCallback((logId: string): boolean => {
    // XOR logic: global state XOR individual override
    return showPrettyView !== expandedLogs.has(logId);
  }, [showPrettyView, expandedLogs]);

  // Filter management
  const filters = useFilters({
    entity: 'logs',
    config: logsFilterConfig,
  });

  // Add default request method filters on mount (POST, PATCH, DELETE)
  // Wait for localStorage to be loaded first
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);

      // Check if there are any request_method filters already
      const hasRequestMethodFilters = filters.activeFilters.some(
        f => f.field === 'data.method'
      );

      // Only add defaults if no request method filters exist
      if (!hasRequestMethodFilters) {
        filters.addFilter({
          type: 'category',
          field: 'data.method',
          operator: '=',
          value: 'POST',
          label: 'Request-Typ: POST',
        });
        filters.addFilter({
          type: 'category',
          field: 'data.method',
          operator: '=',
          value: 'PATCH',
          label: 'Request-Typ: PATCH',
        });
        filters.addFilter({
          type: 'category',
          field: 'data.method',
          operator: '=',
          value: 'DELETE',
          label: 'Request-Typ: DELETE',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialized, filters.activeFilters.length]);

  // Sort management
  const [sortField, setSortField] = useState<string>(logsColumnConfig.defaultSort);
  const [sortColumn, setSortColumn] = useState<string | null>(null);

  // Column visibility management
  const columnVisibility = useColumnVisibility({
    entity: 'logs',
    config: logsColumnConfig,
  });

  // Note: PocketBase logs API (/api/logs) doesn't support real-time subscriptions
  // Logs are retrieved on-demand only

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination when search, filters, or sort change
  useEffect(() => {
    setLogs([]);
    setCurrentPage(1);
    setHasMore(true);
  }, [debouncedSearch, filters.activeFilters, sortField]);

  const fetchLogs = useCallback(async (page: number) => {
    try {
      const isInitialLoad = page === 1;
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      // Build server-side filter from search and active filters
      const filter = filters.buildFilter(debouncedSearch);

      // Use PocketBase logs API directly (not a collection)
      // Build query string manually
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
        sort: sortField,
        fields: 'id,created,level,message,data',
      });

      if (filter) {
        params.set('filter', filter);
      }

      console.log('Fetching logs page', page, 'with filter:', filter);

      const result = await pb.send(`/api/logs?${params.toString()}`, {
        method: 'GET',
      }) as { items: LogEntryRaw[]; page: number; perPage: number; totalItems: number; totalPages: number };

      console.log('Received', result.items.length, 'logs. Total items:', result.totalItems);

      // Normalize log entries
      const normalizedLogs = result.items.map(normalizeLogEntry);

      if (isInitialLoad) {
        setLogs(normalizedLogs);
      } else {
        setLogs((prev) => [...prev, ...normalizedLogs]);
      }

      setHasMore(result.items.length === perPage);
      setCurrentPage(page + 1);
      setError(null);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(
        err instanceof Error ? err.message : 'Fehler beim Laden der Logs'
      );
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [debouncedSearch, filters.buildFilter, sortField, perPage]);

  // Initial load and reload on search/filter/sort change
  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters.activeFilters, sortField]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          fetchLogs(currentPage);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, hasMore, isLoading, isLoadingMore]);

  // Handle column sort
  const handleSort = (columnId: string) => {
    const column = logsColumnConfig.columns.find((c) => c.id === columnId);
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
    const column = logsColumnConfig.columns.find((c) => c.id === columnId);
    const field = column?.sortField || columnId;
    return sortField === field ? 'asc' : sortField === `-${field}` ? 'desc' : null;
  };

  // Render table header cell for a given column
  const renderHeaderCell = (columnId: string) => {
    const column = logsColumnConfig.columns.find((c) => c.id === columnId);
    if (!column) return null;

    if (column.sortable) {
      return (
        <SortableHeader
          label={column.label}
          sortDirection={getSortDirection(columnId)}
          onSort={() => handleSort(columnId)}
        />
      );
    }

    return <span className="text-sm font-medium">{column.label}</span>;
  };

  // Render table body cell for a given column and log
  const renderBodyCell = (columnId: string, log: LogEntry) => {
    switch (columnId) {
      case 'created':
        return (
          <span className="text-sm">
            {formatDateTime(log.created)}
          </span>
        );

      case 'level':
        return (
          <div className="flex items-center gap-2">
            {log.level === 'info' && (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                Info
              </Badge>
            )}
            {log.level === 'warn' && (
              <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                Warnung
              </Badge>
            )}
            {log.level === 'error' && (
              <Badge variant="destructive">
                Fehler
              </Badge>
            )}
          </div>
        );

      case 'method':
        if (!log.data?.method) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }

        // Color-code HTTP methods
        let badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline';
        let badgeClass = '';

        switch (log.data.method) {
          case 'GET':
            badgeClass = 'bg-blue-500 hover:bg-blue-600 text-white';
            break;
          case 'POST':
            badgeClass = 'bg-green-500 hover:bg-green-600 text-white';
            break;
          case 'PATCH':
          case 'PUT':
            badgeClass = 'bg-yellow-500 hover:bg-yellow-600 text-white';
            break;
          case 'DELETE':
            badgeVariant = 'destructive';
            break;
        }

        return (
          <Badge variant={badgeVariant} className={badgeClass}>
            {log.data.method}
          </Badge>
        );

      case 'message':
        // Check if this is a REST request log
        if (isRestRequest(log)) {
          // Determine if we should show pretty view for this log
          const showPretty = shouldShowPretty(log.id);

          if (showPretty) {
            return (
              <LogPrettyView
                log={log}
                onToggle={() => toggleLogView(log.id)}
              />
            );
          } else {
            return (
              <LogRawView
                log={log}
                onToggle={() => toggleLogView(log.id)}
              />
            );
          }
        }

        // Non-REST logs: always show as plain text
        return (
          <span className="text-sm font-mono break-words">
            {log.message}
          </span>
        );

      default:
        return null;
    }
  };

  // Get visible columns in order
  const visibleColumns = columnVisibility.getOrderedColumns(true);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b-2 border-primary bg-background p-4">
        <div className="flex gap-2">
          <FilterPopover
            open={filters.isFilterPopoverOpen}
            onOpenChange={filters.setIsFilterPopoverOpen}
            statusFilters={logsFilterConfig.statusFilters}
            dateFilters={logsFilterConfig.dateFilters}
            categoryFilters={logsFilterConfig.categoryFilters}
            activeFilters={filters.activeFilters}
            onAddFilter={filters.addFilter}
            onRemoveFilter={filters.removeFilter}
            onClearAll={filters.clearAllFilters}
          >
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Logs durchsuchen..."
                disabled={isLoading}
                filters={filters.activeFilters}
                onRemoveFilter={filters.removeFilter}
                onFilterClick={filters.toggleFilterPopover}
                filterCount={filters.filterCount}
              />
            </div>
          </FilterPopover>
          <ColumnSelector
            columns={logsColumnConfig.columns}
            visibleColumns={columnVisibility.visibleColumns}
            columnOrder={columnVisibility.columnOrder}
            onToggle={columnVisibility.toggleColumn}
            onReset={columnVisibility.resetColumns}
            onResetOrder={columnVisibility.resetOrder}
            onReorderColumns={columnVisibility.reorderColumns}
            hiddenCount={columnVisibility.hiddenCount}
          />
          <Button
            onClick={toggleGlobalView}
            size="sm"
            variant={showPrettyView ? 'default' : 'outline'}
            className="h-10"
          >
            {showPrettyView ? (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Formatiert
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Roh
              </>
            )}
          </Button>
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
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {debouncedSearch ? 'Keine Ergebnisse gefunden' : 'Keine Logs gefunden'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-primary">
                  {visibleColumns.map((columnId) => (
                    <th key={columnId} className="px-4 py-3 text-left">
                      {renderHeaderCell(columnId)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    {visibleColumns.map((columnId) => (
                      <td key={columnId} className="px-4 py-3">
                        {renderBodyCell(columnId, log)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Loading More Indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Weitere Logs werden geladen...</span>
              </div>
            )}

            {/* Infinite Scroll Trigger */}
            <div ref={observerTarget} className="h-4" />
          </>
        )}
      </div>
    </div>
  );
}
