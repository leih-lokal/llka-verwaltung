/**
 * CSS Grid rendering: date rows × item columns
 * Handles drag interaction for creating bookings and renders booking blocks.
 *
 * Booking blocks are rendered as direct grid children with explicit
 * gridRow / gridColumn so they natively span multiple date rows.
 *
 * Multi-copy items get dynamic lane columns (based on concurrent booking
 * groups) plus a narrow "+" column for creating new bookings.
 * Drag is single-column (vertical date range only); quantity is set via picker.
 */

'use client';

import { Fragment, useRef, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { BookingBlock } from './booking-block';
import {
  getBookingSpanInMonth,
  type BookingSlot,
  type ItemColumn,
} from '@/lib/utils/booking-grid';
import type { BookingExpanded } from '@/types';
import { FormattedId } from '@/components/ui/formatted-id';

interface DragState {
  /** Index into `columns` array where drag started (locked for the duration) */
  startColIndex: number;
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

  // Group adjacent columns by item for spanning headers
  const itemGroups = useMemo(() => {
    const groups: {
      item: ItemColumn['item'];
      startIndex: number;
      endIndex: number; // inclusive
      isMultiCopy: boolean;
    }[] = [];
    let i = 0;
    while (i < columns.length) {
      const item = columns[i].item;
      const startIndex = i;
      while (i + 1 < columns.length && columns[i + 1].item.id === item.id) {
        i++;
      }
      groups.push({
        item,
        startIndex,
        endIndex: i,
        isMultiCopy: Math.max(1, item.copies) > 1,
      });
      i++;
    }
    return groups;
  }, [columns]);

  const handleMouseDown = useCallback(
    (columnKey: string, dateIndex: number, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('[data-booking-block]')) return;

      const colIndex = columnKeyToIndex.get(columnKey);
      if (colIndex === undefined) return;

      const state: DragState = {
        startColIndex: colIndex,
        startDateIndex: dateIndex,
        endDateIndex: dateIndex,
      };
      dragRef.current = state;
      setDragState(state);
      e.preventDefault();
    },
    [columnKeyToIndex]
  );

  const handleMouseMove = useCallback(
    (_columnKey: string, dateIndex: number, e: React.MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
      if (!dragRef.current) return;

      const newState: DragState = {
        ...dragRef.current,
        endDateIndex: dateIndex,
      };
      dragRef.current = newState;
      setDragState(newState);
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;

    const { startColIndex, startDateIndex, endDateIndex } = dragRef.current;
    const minDate = Math.min(startDateIndex, endDateIndex);
    const maxDate = Math.max(startDateIndex, endDateIndex);

    dragRef.current = null;
    setDragState(null);

    // Require at least 2 days for a booking
    if (minDate === maxDate) return;

    if (dates[minDate] && dates[maxDate]) {
      onCreateBooking(
        [columns[startColIndex].key],
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
      if (colIndex !== dragState.startColIndex) return false;
      const minDate = Math.min(dragState.startDateIndex, dragState.endDateIndex);
      const maxDate = Math.max(dragState.startDateIndex, dragState.endDateIndex);
      return dateIndex >= minDate && dateIndex <= maxDate;
    },
    [dragState]
  );

  // Merge booking slots that share (item, customer_name, start_date, end_date)
  // into single blocks. For multi-copy items all records in a group share one
  // column, so same-index entries merge with copyCount = record count.
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

    const groupKey = (s: BookingSlot) =>
      `${s.booking.item}|${s.booking.customer_name}|${s.booking.start_date}|${s.booking.end_date}`;

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
      entries.sort((a, b) => a.colIndex - b.colIndex);

      // Find runs of adjacent or same-index columns (same-index = multi-copy group)
      let runStart = 0;
      for (let i = 1; i <= entries.length; i++) {
        const isEnd =
          i === entries.length ||
          (entries[i].colIndex !== entries[i - 1].colIndex + 1 &&
            entries[i].colIndex !== entries[i - 1].colIndex);
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

  // Per-column widths: narrow for plus columns, regular for data/single columns
  const colWidths = columns
    .map((c) => (c.isPlusColumn ? '40px' : 'minmax(140px, 1fr)'))
    .join(' ');

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
          gridTemplateColumns: `auto ${colWidths}`,
          gridTemplateRows: `auto repeat(${dates.length}, 36px)`,
        }}
      >
        {/* Top-left corner cell */}
        <div className="sticky left-0 top-0 z-30 bg-background border-b border-r p-2" />

        {/* Column headers — multi-copy items get a spanning header + separate plus header */}
        {itemGroups.map((group) => {
          if (!group.isMultiCopy) {
            return (
              <div
                key={group.item.id}
                className="sticky top-0 z-20 bg-background border-b p-2 text-center text-xs font-semibold truncate flex items-center justify-center gap-1.5"
                style={{ gridColumn: gridColIndex(group.startIndex) }}
                title={group.item.name}
              >
                <FormattedId id={group.item.iid} size="sm" />
                {group.item.name}
              </div>
            );
          }

          // Multi-copy: data header spans all data columns, plus header is separate
          const dataEnd = group.endIndex - 1; // last column before plus
          const plusIndex = group.endIndex; // plus is always last

          return (
            <Fragment key={group.item.id}>
              <div
                className="sticky top-0 z-20 bg-background border-b p-2 text-center text-xs font-semibold truncate flex items-center justify-center gap-1.5"
                style={{
                  gridColumn: `${gridColIndex(group.startIndex)} / ${gridColIndex(dataEnd) + 1}`,
                }}
                title={`${group.item.name} (${group.item.copies}×)`}
              >
                <FormattedId id={group.item.iid} size="sm" />
                {group.item.name}
                <span className="text-muted-foreground font-normal">
                  ({group.item.copies}×)
                </span>
              </div>
              <div
                className="sticky top-0 z-20 bg-background border-b p-1 text-center font-bold flex items-center justify-center"
                style={{ gridColumn: gridColIndex(plusIndex) }}
                title="Neue Buchung erstellen"
              >
                +
              </div>
            </Fragment>
          );
        })}

        {/* Date rows */}
        {dates.map((date, dateIndex) => {
          const isToday = isSameDay(date, today);
          const closed = isClosedDay(date);
          const gridRow = dateIndex + 2;

          return (
            <Fragment key={dateIndex}>
              {/* Date label cell */}
              <div
                className={cn(
                  'sticky left-0 z-10 border-b border-r px-3 py-1 text-xs font-mono whitespace-nowrap flex items-center bg-background',
                  closed && 'bg-muted',
                  isToday && 'border-l-2 border-l-primary font-bold'
                )}
                style={{ gridRow, gridColumn: 1 }}
              >
                {formatGridDate(date)}
              </div>

              {/* Cells for mouse interaction */}
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
                  >
                    {col.isPlusColumn && (
                      <span className="flex items-center justify-center h-full text-muted-foreground/25 font-bold text-sm select-none">
                        +
                      </span>
                    )}
                  </div>
                );
              })}
            </Fragment>
          );
        })}

        {/* Booking blocks */}
        {mergedBlocks.map((block) => (
          <BookingBlock
            key={block.key}
            slot={block.slot}
            gridRowStart={block.gridRowStart}
            gridRowEnd={block.gridRowEnd}
            gridColumnStart={block.gridColumnStart}
            gridColumnEnd={block.gridColumnEnd}
            copyCount={block.copyCount}
            onClick={(e) =>
              onBookingClick(block.slot.booking, {
                x: e.clientX,
                y: e.clientY,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}
