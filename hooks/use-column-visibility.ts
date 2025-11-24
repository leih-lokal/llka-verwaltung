/**
 * Hook for managing column visibility and order with localStorage persistence
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { EntityColumnConfig } from '@/lib/tables/column-configs';

export interface UseColumnVisibilityOptions {
  /** Entity type for localStorage key */
  entity: 'customers' | 'items' | 'rentals' | 'reservations' | 'logs';

  /** Column configuration */
  config: EntityColumnConfig;

  /** Enable localStorage persistence */
  persist?: boolean;
}

export function useColumnVisibility({
  entity,
  config,
  persist = true,
}: UseColumnVisibilityOptions) {
  // Initialize with default visible columns
  const defaultVisibleColumns = config.columns
    .filter((col) => col.defaultVisible)
    .map((col) => col.id);

  // Initialize with default column order (all columns in config order)
  const defaultColumnOrder = config.columns.map((col) => col.id);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleColumns);
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultColumnOrder);

  // Storage keys for this entity
  const visibilityStorageKey = `column_visibility_${entity}`;
  const orderStorageKey = `column_order_${entity}`;

  // Load from localStorage on mount
  useEffect(() => {
    if (!persist) return;

    try {
      // Load visibility
      const storedVisibility = localStorage.getItem(visibilityStorageKey);
      if (storedVisibility) {
        const savedColumns = JSON.parse(storedVisibility) as string[];
        setVisibleColumns(savedColumns);
      }

      // Load order
      const storedOrder = localStorage.getItem(orderStorageKey);
      if (storedOrder) {
        const savedOrder = JSON.parse(storedOrder) as string[];
        // Validate that saved order contains all current columns
        const currentColumnIds = config.columns.map((col) => col.id);
        const validOrder = savedOrder.filter((id) => currentColumnIds.includes(id));

        // Add any new columns that aren't in saved order to the end
        const missingColumns = currentColumnIds.filter((id) => !validOrder.includes(id));
        const completeOrder = [...validOrder, ...missingColumns];

        setColumnOrder(completeOrder);
      }
    } catch (error) {
      console.error('Failed to load column state from localStorage:', error);
    }
  }, [visibilityStorageKey, orderStorageKey, persist, config.columns]);

  // Save visibility to localStorage when it changes
  useEffect(() => {
    if (!persist) return;

    try {
      localStorage.setItem(visibilityStorageKey, JSON.stringify(visibleColumns));
    } catch (error) {
      console.error('Failed to save column visibility to localStorage:', error);
    }
  }, [visibleColumns, visibilityStorageKey, persist]);

  // Save order to localStorage when it changes
  useEffect(() => {
    if (!persist) return;

    try {
      localStorage.setItem(orderStorageKey, JSON.stringify(columnOrder));
    } catch (error) {
      console.error('Failed to save column order to localStorage:', error);
    }
  }, [columnOrder, orderStorageKey, persist]);

  /**
   * Toggle column visibility
   */
  const toggleColumn = useCallback((columnId: string) => {
    setVisibleColumns((prev) => {
      if (prev.includes(columnId)) {
        // Don't allow hiding all columns
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== columnId);
      } else {
        return [...prev, columnId];
      }
    });
  }, []);

  /**
   * Reset to default visibility
   */
  const resetColumns = useCallback(() => {
    setVisibleColumns(defaultVisibleColumns);
  }, [defaultVisibleColumns]);

  /**
   * Reset to default column order
   */
  const resetOrder = useCallback(() => {
    setColumnOrder(defaultColumnOrder);
  }, [defaultColumnOrder]);

  /**
   * Reorder columns (used for drag and drop)
   */
  const reorderColumns = useCallback((startIndex: number, endIndex: number) => {
    setColumnOrder((prev) => {
      const result = [...prev];
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, []);

  /**
   * Check if a column is visible
   */
  const isColumnVisible = useCallback(
    (columnId: string) => {
      return visibleColumns.includes(columnId);
    },
    [visibleColumns]
  );

  /**
   * Get columns in their current order, optionally filtered by visibility
   */
  const getOrderedColumns = useCallback(
    (onlyVisible = false) => {
      if (onlyVisible) {
        return columnOrder.filter((id) => visibleColumns.includes(id));
      }
      return columnOrder;
    },
    [columnOrder, visibleColumns]
  );

  /**
   * Get number of hidden columns
   */
  const hiddenCount = config.columns.length - visibleColumns.length;

  return {
    visibleColumns,
    columnOrder,
    toggleColumn,
    resetColumns,
    resetOrder,
    reorderColumns,
    isColumnVisible,
    getOrderedColumns,
    hiddenCount,
  };
}
