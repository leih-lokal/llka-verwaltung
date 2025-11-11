/**
 * Column visibility and order selector component with drag-and-drop
 */

'use client';

import { Columns, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ColumnConfig } from '@/lib/tables/column-configs';

export interface ColumnSelectorProps {
  /** Available columns */
  columns: ColumnConfig[];

  /** Currently visible column IDs */
  visibleColumns: string[];

  /** Current column order (array of column IDs) */
  columnOrder: string[];

  /** Callback when column visibility is toggled */
  onToggle: (columnId: string) => void;

  /** Callback to reset visibility to defaults */
  onReset: () => void;

  /** Callback to reset column order to defaults */
  onResetOrder: () => void;

  /** Callback when columns are reordered */
  onReorderColumns: (startIndex: number, endIndex: number) => void;

  /** Number of hidden columns */
  hiddenCount?: number;
}

/**
 * Sortable column item component
 */
interface SortableColumnItemProps {
  column: ColumnConfig;
  isVisible: boolean;
  isLastVisible: boolean;
  onToggle: (columnId: string) => void;
}

function SortableColumnItem({
  column,
  isVisible,
  isLastVisible,
  onToggle,
}: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <DropdownMenuCheckboxItem
        checked={isVisible}
        onCheckedChange={() => onToggle(column.id)}
        disabled={isLastVisible}
        className="flex-1"
      >
        {column.label}
      </DropdownMenuCheckboxItem>
    </div>
  );
}

export function ColumnSelector({
  columns,
  visibleColumns,
  columnOrder,
  onToggle,
  onReset,
  onResetOrder,
  onReorderColumns,
  hiddenCount = 0,
}: ColumnSelectorProps) {
  // Set up drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(active.id as string);
      const newIndex = columnOrder.indexOf(over.id as string);
      onReorderColumns(oldIndex, newIndex);
    }
  };

  // Create a map of columns by ID for quick lookup
  const columnMap = new Map(columns.map((col) => [col.id, col]));

  // Get ordered columns based on columnOrder
  const orderedColumns = columnOrder
    .map((id) => columnMap.get(id))
    .filter((col): col is ColumnConfig => col !== undefined);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 gap-1.5">
          <Columns className="h-4 w-4" />
          <span>Spalten</span>
          {hiddenCount > 0 && (
            <span className="ml-1 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
              -{hiddenCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Spalten anpassen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columnOrder}
            strategy={verticalListSortingStrategy}
          >
            {orderedColumns.map((column) => {
              const isVisible = visibleColumns.includes(column.id);
              const isLastVisible = visibleColumns.length === 1 && isVisible;

              return (
                <SortableColumnItem
                  key={column.id}
                  column={column}
                  isVisible={isVisible}
                  isLastVisible={isLastVisible}
                  onToggle={onToggle}
                />
              );
            })}
          </SortableContext>
        </DndContext>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-sm">
          <button
            onClick={onReset}
            className="w-full text-left hover:bg-muted rounded px-2 py-1.5 transition-colors"
          >
            Sichtbarkeit zurücksetzen
          </button>
          <button
            onClick={onResetOrder}
            className="w-full text-left hover:bg-muted rounded px-2 py-1.5 transition-colors"
          >
            Reihenfolge zurücksetzen
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
