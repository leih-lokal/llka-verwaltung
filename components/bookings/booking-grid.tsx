/**
 * CSS Grid rendering: date rows × item-copy columns
 * Handles drag interaction for creating bookings and renders booking blocks.
 *
 * Booking blocks are rendered as direct grid children with explicit
 * gridRow / gridColumn so they natively span multiple date rows.
 *
 * Drag supports both Y (date range) and X (multiple copies of same item).
 */

'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { BookingBlock } from './booking-block';
import {
  getBookingSpanInMonth,
  getColumnLabel,
  type BookingSlot,
  type ItemColumn,
} from '@/lib/utils/booking-grid';
import type { BookingExpanded } from '@/types';
import { FormattedId } from '@/components/ui/formatted-id';

interface DragState {
  /** Item ID that the drag is constrained to */
  itemId: string;
  /** Index into `columns` array where drag started */
  startColIndex: number;
  /** Index into `columns` array where drag currently is */
  endColIndex: number;
  startDateIndex: number;
  endDateIndex: number;
}

interface BookingGridProps {
  dates: Date[];
  columns: ItemColumn[];
  bookingSlots: BookingSlot[];
  onCreateBooking: (
    columnKeys: string[],
    startDate: Date,
    endDate: Date,
    mousePosition: { x: number; y: number }
  ) => void;
  onBookingClick: (booking: BookingExpanded, position: { x: number; y: number }) => void;
}

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function formatGridDate(date: Date): string {
  const day = DAY_NAMES[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${day} ${dd}.${mm}.`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Closed days: Sunday (0), Tuesday (2), Wednesday (3) */
function isClosedDay(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 2 || day === 3;
}

export function BookingGrid({
  dates,
  columns,
  bookingSlots,
  onCreateBooking,
  onBookingClick,
}: BookingGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const today = useMemo(() => new Date(), []);

  // Map column key → index in the columns array
  const columnKeyToIndex = useMemo(() => {
    const map = new Map<string, number>();
    columns.forEach((col, i) => map.set(col.key, i));
    return map;
  }, [columns]);

  // Grid column index: columns array index + 2 (col 1 = date labels, 1-indexed)
  const gridColIndex = (arrIndex: number) => arrIndex + 2;

  const handleMouseDown = useCallback(
    (columnKey: string, dateIndex: number, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('[data-booking-block]')) return;

      const colIndex = columnKeyToIndex.get(columnKey);
      if (colIndex === undefined) return;

      const state: DragState = {
        itemId: columns[colIndex].item.id,
        startColIndex: colIndex,
        endColIndex: colIndex,
        startDateIndex: dateIndex,
        endDateIndex: dateIndex,
      };
      dragRef.current = state;
      setDragState(state);
      e.preventDefault();
    },
    [columnKeyToIndex, columns]
  );

  const handleMouseMove = useCallback(
    (columnKey: string, dateIndex: number, e: React.MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
      if (!dragRef.current) return;

      const colIndex = columnKeyToIndex.get(columnKey);
      if (colIndex === undefined) return;

      // Allow cross-column drag only within the same item
      const col = columns[colIndex];
      if (col.item.id !== dragRef.current.itemId) return;

      const newState: DragState = {
        ...dragRef.current,
        endColIndex: colIndex,
        endDateIndex: dateIndex,
      };
      dragRef.current = newState;
      setDragState(newState);
    },
    [columnKeyToIndex, columns]
  );

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;

    const { startColIndex, endColIndex, startDateIndex, endDateIndex } = dragRef.current;
    const minDate = Math.min(startDateIndex, endDateIndex);
    const maxDate = Math.max(startDateIndex, endDateIndex);
    const minCol = Math.min(startColIndex, endColIndex);
    const maxCol = Math.max(startColIndex, endColIndex);

    dragRef.current = null;
    setDragState(null);

    // Require at least 2 days for a booking
    if (minDate === maxDate) return;

    if (dates[minDate] && dates[maxDate]) {
      const selectedKeys = columns
        .slice(minCol, maxCol + 1)
        .map((c) => c.key);

      onCreateBooking(
        selectedKeys,
        dates[minDate],
        dates[maxDate],
        mousePositionRef.current
      );
    }
  }, [dates, columns, onCreateBooking]);

  const handleMouseLeave = useCallback(() => {
    dragRef.current = null;
    setDragState(null);
  }, []);

  const isDragSelected = useCallback(
    (colIndex: number, dateIndex: number): boolean => {
      if (!dragState) return false;
      const minCol = Math.min(dragState.startColIndex, dragState.endColIndex);
      const maxCol = Math.max(dragState.startColIndex, dragState.endColIndex);
      const minDate = Math.min(dragState.startDateIndex, dragState.endDateIndex);
      const maxDate = Math.max(dragState.startDateIndex, dragState.endDateIndex);
      return colIndex >= minCol && colIndex <= maxCol && dateIndex >= minDate && dateIndex <= maxDate;
    },
    [dragState]
  );

  // Merge adjacent booking slots that share (item, customer_name, start_date, end_date)
  // into a single wide block spanning multiple grid columns.
  const mergedBlocks = useMemo(() => {
    interface MergedBlock {
      key: string;
      slot: BookingSlot;
      gridRowStart: number;
      gridRowEnd: number;
      gridColumnStart: number;
      gridColumnEnd: number;
      copyCount: number;
    }

    // Group key: item + customer_name + start_date + end_date
    const groupKey = (s: BookingSlot) =>
      `${s.booking.item}|${s.booking.customer_name}|${s.booking.start_date}|${s.booking.end_date}`;

    // Build groups of slots with the same logical booking
    const groups = new Map<string, { slot: BookingSlot; colIndex: number }[]>();
    for (const slot of bookingSlots) {
      const ci = columnKeyToIndex.get(slot.columnKey);
      if (ci === undefined) continue;
      const k = groupKey(slot);
      const arr = groups.get(k) || [];
      arr.push({ slot, colIndex: ci });
      groups.set(k, arr);
    }

    const blocks: MergedBlock[] = [];

    for (const entries of groups.values()) {
      // Sort by column index
      entries.sort((a, b) => a.colIndex - b.colIndex);

      // Find runs of adjacent columns
      let runStart = 0;
      for (let i = 1; i <= entries.length; i++) {
        const isEnd = i === entries.length || entries[i].colIndex !== entries[i - 1].colIndex + 1;
        if (isEnd) {
          const run = entries.slice(runStart, i);
          const firstSlot = run[0].slot;
          const span = getBookingSpanInMonth(firstSlot, dates);
          if (span) {
            blocks.push({
              key: run.map((r) => r.slot.booking.id).join('+'),
              slot: firstSlot,
              gridRowStart: span.startRow,
              gridRowEnd: span.endRow,
              gridColumnStart: gridColIndex(run[0].colIndex),
              gridColumnEnd: gridColIndex(run[run.length - 1].colIndex) + 1,
              copyCount: run.length,
            });
          }
          runStart = i;
        }
      }
    }

    return blocks;
  }, [bookingSlots, columnKeyToIndex, dates]);

  if (columns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center">
          <p className="text-lg font-medium">Keine geschützten Gegenstände</p>
          <p className="text-sm mt-1">
            Markiere Gegenstände als &quot;geschützt&quot; um sie hier zu verwalten.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className="flex-1 overflow-auto select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="grid min-w-max"
        style={{
          gridTemplateColumns: `auto repeat(${columns.length}, minmax(140px, 1fr))`,
          gridTemplateRows: `auto repeat(${dates.length}, 36px)`,
        }}
      >
        {/* Top-left corner cell */}
        <div className="sticky left-0 top-0 z-30 bg-background border-b border-r p-2" />

        {/* Column headers */}
        {columns.map((col) => (
          <div
            key={col.key}
            className="sticky top-0 z-20 bg-background border-b p-2 text-center text-xs font-semibold truncate flex items-center justify-center gap-1.5"
            title={getColumnLabel(col)}
          >
            <FormattedId id={col.item.iid} size="sm" />
            {getColumnLabel(col)}
          </div>
        ))}

        {/* Date rows — cells only (no booking blocks here) */}
        {dates.map((date, dateIndex) => {
          const isToday = isSameDay(date, today);
          const closed = isClosedDay(date);
          const gridRow = dateIndex + 2;

          return (
            <>
              {/* Date label cell */}
              <div
                key={`date-${dateIndex}`}
                className={cn(
                  'sticky left-0 z-10 border-b border-r px-3 py-1 text-xs font-mono whitespace-nowrap flex items-center bg-background',
                  closed && 'bg-muted',
                  isToday && 'border-l-2 border-l-primary font-bold'
                )}
                style={{ gridRow, gridColumn: 1 }}
              >
                {formatGridDate(date)}
              </div>

              {/* Empty cells for mouse interaction */}
              {columns.map((col, colIndex) => {
                const selected = isDragSelected(colIndex, dateIndex);

                return (
                  <div
                    key={`${col.key}-${dateIndex}`}
                    className={cn(
                      'border-b border-r cursor-crosshair',
                      closed && 'bg-muted',
                      selected && 'bg-primary/20'
                    )}
                    style={{ gridRow, gridColumn: gridColIndex(colIndex) }}
                    onMouseDown={(e) => handleMouseDown(col.key, dateIndex, e)}
                    onMouseMove={(e) => handleMouseMove(col.key, dateIndex, e)}
                  />
                );
              })}
            </>
          );
        })}

        {/* Booking blocks — merge adjacent same-group slots into wide blocks */}
        {mergedBlocks.map((block) => (
          <BookingBlock
            key={block.key}
            slot={block.slot}
            gridRowStart={block.gridRowStart}
            gridRowEnd={block.gridRowEnd}
            gridColumnStart={block.gridColumnStart}
            gridColumnEnd={block.gridColumnEnd}
            copyCount={block.copyCount}
            onClick={(e) => onBookingClick(block.slot.booking, { x: e.clientX, y: e.clientY })}
          />
        ))}
      </div>
    </div>
  );
}
