/**
 * Filter popover with tabs for different filter types
 */

'use client';

import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TriStateCheckbox } from '@/components/ui/tri-state-checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { FilterConfig } from '@/lib/filters/filter-configs';
import type { ActiveFilter } from '@/lib/filters/filter-utils';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Get date range for quick filters
 */
function getQuickDateRange(range: 'today' | 'yesterday' | 'this_week' | 'last_week'): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case 'today': {
      const start = new Date(today);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }
    case 'yesterday': {
      const start = new Date(today);
      start.setDate(start.getDate() - 1);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }
    case 'this_week': {
      const start = new Date(today);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start.setDate(diff);
      const end = new Date(start);
      end.setDate(end.getDate() + 6); // Sunday
      end.setHours(23, 59, 59, 999);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }
    case 'last_week': {
      const start = new Date(today);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1) - 7; // Last Monday
      start.setDate(diff);
      const end = new Date(start);
      end.setDate(end.getDate() + 6); // Last Sunday
      end.setHours(23, 59, 59, 999);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }
  }
}

export interface FilterPopoverProps {
  /** The trigger element (usually a button) */
  children: React.ReactNode;

  /** Is popover open */
  open?: boolean;

  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;

  /** Status filter configs */
  statusFilters?: FilterConfig[];

  /** Date filter configs */
  dateFilters?: FilterConfig[];

  /** Category filter configs */
  categoryFilters?: FilterConfig[];

  /** Numeric filter configs */
  numericFilters?: FilterConfig[];

  /** Text filter configs */
  textFilters?: FilterConfig[];

  /** Current active filters */
  activeFilters: ActiveFilter[];

  /** Callback when filter is added */
  onAddFilter: (filter: Omit<ActiveFilter, 'id'>) => void;

  /** Callback when filter is removed */
  onRemoveFilter: (filterId: string) => void;

  /** Callback when all filters are cleared */
  onClearAll: () => void;
}

export function FilterPopover({
  children,
  open,
  onOpenChange,
  statusFilters = [],
  dateFilters = [],
  categoryFilters = [],
  numericFilters = [],
  textFilters = [],
  activeFilters,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
}: FilterPopoverProps) {
  const [dateRanges, setDateRanges] = useState<
    Record<string, { start: string; end: string }>
  >({});
  const [numericRanges, setNumericRanges] = useState<
    Record<string, { min: string; max: string }>
  >({});
  const [textValues, setTextValues] = useState<Record<string, string>>({});

  // Count filters by type
  const statusCount = activeFilters.filter((f) => f.type === 'status').length;
  const dateCount = activeFilters.filter((f) => f.type === 'date').length;
  const categoryCount = activeFilters.filter((f) => f.type === 'category').length;
  const numericCount = activeFilters.filter((f) => f.type === 'numeric').length;
  const textCount = activeFilters.filter((f) => f.type === 'text').length;

  // Determine which tabs to show
  const hasStatus = statusFilters.length > 0;
  const hasDate = dateFilters.length > 0;
  const hasCategory = categoryFilters.length > 0;
  const hasNumeric = numericFilters.length > 0;
  const hasText = textFilters.length > 0;

  const defaultTab = hasStatus
    ? 'status'
    : hasDate
    ? 'date'
    : hasCategory
    ? 'category'
    : hasNumeric
    ? 'numeric'
    : 'text';

  // Check if a filter is active
  const isFilterActive = (field: string, value: string) => {
    return activeFilters.some(
      (f) => f.field === field && String(f.value) === value
    );
  };

  // Get tri-state for a filter option
  const getFilterState = (field: string, value: string): 'unchecked' | 'checked' | 'excluded' => {
    const filter = activeFilters.find(f => f.field === field && String(f.value) === value);
    if (!filter) return 'unchecked';
    return filter.exclude ? 'excluded' : 'checked';
  };

  // Handle status/category filter toggle (tri-state)
  const handleToggleFilter = (
    config: FilterConfig,
    optionValue: string,
    optionLabel: string
  ) => {
    const currentState = getFilterState(config.field, optionValue);

    // Cycle through states: unchecked → checked → excluded → unchecked
    const nextState =
      currentState === 'unchecked' ? 'checked' :
      currentState === 'checked' ? 'excluded' :
      'unchecked';

    // Remove existing filter if any
    const existingFilter = activeFilters.find(
      (f) => f.field === config.field && String(f.value) === optionValue
    );
    if (existingFilter) {
      onRemoveFilter(existingFilter.id);
    }

    // Add new filter if not going to unchecked
    if (nextState !== 'unchecked') {
      onAddFilter({
        type: config.type as 'status' | 'category',
        field: config.field,
        operator: nextState === 'excluded' ? '!=' : '=',
        value: optionValue,
        label: `${config.label}: ${nextState === 'excluded' ? 'NICHT ' : ''}${optionLabel}`,
        exclude: nextState === 'excluded',
      });
    }
  };

  // Handle date range filter
  const handleApplyDateRange = (config: FilterConfig) => {
    const range = dateRanges[config.id];
    if (range?.start && range?.end) {
      onAddFilter({
        type: 'date',
        field: config.field,
        operator: '>=',
        value: [range.start, range.end],
        label: `${config.label}: ${new Date(range.start).toLocaleDateString('de-DE')} - ${new Date(range.end).toLocaleDateString('de-DE')}`,
      });
      // Clear the range
      setDateRanges((prev) => ({ ...prev, [config.id]: { start: '', end: '' } }));
    }
  };

  // Handle quick date filter
  const handleQuickDateFilter = (config: FilterConfig, rangeType: 'today' | 'yesterday' | 'this_week' | 'last_week', label: string) => {
    const range = getQuickDateRange(rangeType);
    onAddFilter({
      type: 'date',
      field: config.field,
      operator: '>=',
      value: [range.start, range.end],
      label: `${config.label}: ${label}`,
    });
  };

  // Handle numeric range filter
  const handleApplyNumericRange = (config: FilterConfig) => {
    const range = numericRanges[config.id];
    if (range?.min || range?.max) {
      const min = range.min ? Number(range.min) : config.min || 0;
      const max = range.max ? Number(range.max) : config.max || 999999;

      onAddFilter({
        type: 'numeric',
        field: config.field,
        operator: '>=',
        value: [min, max],
        label: `${config.label}: ${min} - ${max}`,
      });
      // Clear the range
      setNumericRanges((prev) => ({ ...prev, [config.id]: { min: '', max: '' } }));
    }
  };

  // Handle text filter
  const handleApplyTextFilter = (config: FilterConfig) => {
    const value = textValues[config.id];
    if (value && value.trim()) {
      onAddFilter({
        type: 'text',
        field: config.field,
        operator: '~',
        value: value.trim(),
        label: `${config.label}: ${value.trim()}`,
      });
      // Clear the text
      setTextValues((prev) => ({ ...prev, [config.id]: '' }));
    }
  };

  return (
    <div className="relative flex-1">
      {children}
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <div className="absolute top-10 left-0 w-0 h-0 pointer-events-none" />
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start" sideOffset={5}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Filter</h4>
            {activeFilters.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearAll}>
                Alle löschen
              </Button>
            )}
          </div>

          <Separator />

          {/* Filter tabs */}
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              {hasStatus && (
                <TabsTrigger value="status" className="text-xs relative">
                  Status
                  {statusCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                      {statusCount}
                    </span>
                  )}
                </TabsTrigger>
              )}
              {hasDate && (
                <TabsTrigger value="date" className="text-xs relative">
                  Datum
                  {dateCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                      {dateCount}
                    </span>
                  )}
                </TabsTrigger>
              )}
              {hasCategory && (
                <TabsTrigger value="category" className="text-xs relative">
                  Kategorie
                  {categoryCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                      {categoryCount}
                    </span>
                  )}
                </TabsTrigger>
              )}
              {hasNumeric && (
                <TabsTrigger value="numeric" className="text-xs relative">
                  Wert
                  {numericCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                      {numericCount}
                    </span>
                  )}
                </TabsTrigger>
              )}
              {hasText && (
                <TabsTrigger value="text" className="text-xs relative">
                  Text
                  {textCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                      {textCount}
                    </span>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            {/* Status filters */}
            {hasStatus && (
              <TabsContent value="status" className="space-y-3 max-h-64 overflow-y-auto">
                {statusFilters.map((config) => (
                  <div key={config.id} className="space-y-2">
                    <Label className="text-xs font-medium">{config.label}</Label>
                    <div className="space-y-2">
                      {config.options?.map((option) => {
                        const state = getFilterState(config.field, option.value);
                        return (
                          <div key={option.value} className="flex items-center space-x-2">
                            <TriStateCheckbox
                              id={`${config.id}-${option.value}`}
                              state={state}
                              onStateChange={() =>
                                handleToggleFilter(config, option.value, option.label)
                              }
                            />
                            <label
                              htmlFor={`${config.id}-${option.value}`}
                              className={cn(
                                "text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer",
                                state === 'excluded' && "line-through text-muted-foreground"
                              )}
                            >
                              {option.label}
                              {state === 'excluded' && (
                                <span className="ml-1.5 text-xs text-destructive font-normal">(ausgeschlossen)</span>
                              )}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </TabsContent>
            )}

            {/* Date filters */}
            {hasDate && (
              <TabsContent value="date" className="space-y-4 max-h-64 overflow-y-auto">
                {dateFilters.map((config) => (
                  <div key={config.id} className="space-y-2">
                    <Label className="text-xs font-medium">{config.label}</Label>

                    {/* Quick filter buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => handleQuickDateFilter(config, 'today', 'Heute')}
                      >
                        Heute
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => handleQuickDateFilter(config, 'yesterday', 'Gestern')}
                      >
                        Gestern
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => handleQuickDateFilter(config, 'this_week', 'Diese Woche')}
                      >
                        Diese Woche
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => handleQuickDateFilter(config, 'last_week', 'Letzte Woche')}
                      >
                        Letzte Woche
                      </Button>
                    </div>

                    <Separator className="my-2" />

                    {/* Manual date inputs */}
                    <Label className="text-xs text-muted-foreground">Eigener Zeitraum</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        placeholder="Von"
                        value={dateRanges[config.id]?.start || ''}
                        onChange={(e) =>
                          setDateRanges((prev) => ({
                            ...prev,
                            [config.id]: { ...prev[config.id], start: e.target.value },
                          }))
                        }
                        className="text-xs"
                      />
                      <Input
                        type="date"
                        placeholder="Bis"
                        value={dateRanges[config.id]?.end || ''}
                        onChange={(e) =>
                          setDateRanges((prev) => ({
                            ...prev,
                            [config.id]: { ...prev[config.id], end: e.target.value },
                          }))
                        }
                        className="text-xs"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => handleApplyDateRange(config)}
                      disabled={!dateRanges[config.id]?.start || !dateRanges[config.id]?.end}
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Anwenden
                    </Button>
                  </div>
                ))}
              </TabsContent>
            )}

            {/* Category filters */}
            {hasCategory && (
              <TabsContent value="category" className="space-y-3 max-h-64 overflow-y-auto">
                {categoryFilters.map((config) => {
                  const isColorFilter = config.id === 'highlight_color';
                  const colorMap: Record<string, string> = {
                    red: 'bg-red-500',
                    orange: 'bg-orange-500',
                    yellow: 'bg-yellow-500',
                    green: 'bg-green-500',
                    teal: 'bg-teal-500',
                    blue: 'bg-blue-500',
                    purple: 'bg-purple-500',
                    pink: 'bg-pink-500',
                  };

                  return (
                    <div key={config.id} className="space-y-2">
                      <Label className="text-xs font-medium">{config.label}</Label>
                      <div className="space-y-2">
                        {config.options?.map((option) => {
                          const state = getFilterState(config.field, option.value);
                          return (
                            <div key={option.value} className="flex items-center space-x-2">
                              <TriStateCheckbox
                                id={`${config.id}-${option.value}`}
                                state={state}
                                onStateChange={() =>
                                  handleToggleFilter(config, option.value, option.label)
                                }
                              />
                              <label
                                htmlFor={`${config.id}-${option.value}`}
                                className={cn(
                                  "text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2",
                                  state === 'excluded' && "line-through text-muted-foreground"
                                )}
                              >
                                {isColorFilter && colorMap[option.value] && (
                                  <span className={cn("size-3 rounded-full shrink-0", colorMap[option.value])} />
                                )}
                                <span>
                                  {option.label}
                                  {state === 'excluded' && (
                                    <span className="ml-1.5 text-xs text-destructive font-normal">(ausgeschlossen)</span>
                                  )}
                                </span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            )}

            {/* Numeric filters */}
            {hasNumeric && (
              <TabsContent value="numeric" className="space-y-4 max-h-64 overflow-y-auto">
                {numericFilters.map((config) => (
                  <div key={config.id} className="space-y-2">
                    <Label className="text-xs font-medium">{config.label}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder={`Min (${config.min || 0})`}
                        value={numericRanges[config.id]?.min || ''}
                        onChange={(e) =>
                          setNumericRanges((prev) => ({
                            ...prev,
                            [config.id]: { ...prev[config.id], min: e.target.value },
                          }))
                        }
                        min={config.min}
                        max={config.max}
                        className="text-xs"
                      />
                      <Input
                        type="number"
                        placeholder={`Max (${config.max || '∞'})`}
                        value={numericRanges[config.id]?.max || ''}
                        onChange={(e) =>
                          setNumericRanges((prev) => ({
                            ...prev,
                            [config.id]: { ...prev[config.id], max: e.target.value },
                          }))
                        }
                        min={config.min}
                        max={config.max}
                        className="text-xs"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => handleApplyNumericRange(config)}
                      disabled={!numericRanges[config.id]?.min && !numericRanges[config.id]?.max}
                    >
                      Anwenden
                    </Button>
                  </div>
                ))}
              </TabsContent>
            )}

            {/* Text filters */}
            {hasText && (
              <TabsContent value="text" className="space-y-4 max-h-64 overflow-y-auto">
                {textFilters.map((config) => (
                  <div key={config.id} className="space-y-2">
                    <Label className="text-xs font-medium">{config.label}</Label>
                    <Input
                      type="text"
                      placeholder={config.placeholder}
                      value={textValues[config.id] || ''}
                      onChange={(e) =>
                        setTextValues((prev) => ({
                          ...prev,
                          [config.id]: e.target.value,
                        }))
                      }
                      className="text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => handleApplyTextFilter(config)}
                      disabled={!textValues[config.id]?.trim()}
                    >
                      Anwenden
                    </Button>
                  </div>
                ))}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </PopoverContent>
      </Popover>
    </div>
  );
}
