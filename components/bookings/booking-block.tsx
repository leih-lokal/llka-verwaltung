/**
 * Single booking visual block in the grid
 * Rendered as a direct CSS Grid child that spans multiple rows and optionally columns
 * Color is derived from the customer name for consistent per-person coloring.
 */

'use client';

import { CircleCheckBig, PackageCheck } from 'lucide-react';
import { BookingStatus } from '@/types';
import { BOOKING_STATUS_LABELS } from '@/lib/constants/statuses';
import type { BookingSlot } from '@/lib/utils/booking-grid';

/** Soft pastel palette — bg, text, border */
const BLOCK_PALETTE = [
  { bg: 'hsl(210 80% 92%)', text: 'hsl(210 60% 28%)', border: 'hsl(210 60% 72%)' },
  { bg: 'hsl(340 70% 92%)', text: 'hsl(340 55% 30%)', border: 'hsl(340 55% 72%)' },
  { bg: 'hsl(160 60% 90%)', text: 'hsl(160 50% 25%)', border: 'hsl(160 50% 68%)' },
  { bg: 'hsl(40 80% 90%)',  text: 'hsl(40 60% 28%)',  border: 'hsl(40 60% 68%)' },
  { bg: 'hsl(270 60% 92%)', text: 'hsl(270 45% 30%)', border: 'hsl(270 45% 72%)' },
  { bg: 'hsl(15 75% 91%)',  text: 'hsl(15 55% 28%)',  border: 'hsl(15 55% 68%)' },
  { bg: 'hsl(190 65% 90%)', text: 'hsl(190 50% 25%)', border: 'hsl(190 50% 68%)' },
  { bg: 'hsl(90 50% 90%)',  text: 'hsl(90 40% 25%)',  border: 'hsl(90 40% 65%)' },
  { bg: 'hsl(320 55% 92%)', text: 'hsl(320 40% 30%)', border: 'hsl(320 40% 70%)' },
  { bg: 'hsl(50 70% 89%)',  text: 'hsl(50 55% 26%)',  border: 'hsl(50 55% 65%)' },
];

/** Simple string hash → index into palette */
function hashToIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % BLOCK_PALETTE.length;
}

/** Overdue bookings get a distinct red treatment regardless of customer */
const OVERDUE_COLORS = {
  bg: 'hsl(0 70% 94%)',
  text: 'hsl(0 65% 32%)',
  border: 'hsl(0 65% 70%)',
};

/** Active bookings: green left accent color */
const ACTIVE_ACCENT = 'hsl(142 60% 40%)';

/** Returned bookings: muted grey treatment */
const RETURNED_COLORS = {
  bg: 'hsl(0 0% 94%)',
  text: 'hsl(0 0% 45%)',
  border: 'hsl(0 0% 80%)',
};
const RETURNED_ACCENT = 'hsl(0 0% 55%)';

interface BookingBlockProps {
  slot: BookingSlot;
  gridRowStart: number;
  gridRowEnd: number;
  gridColumnStart: number;
  gridColumnEnd: number;
  copyCount: number;
  onClick: (e: React.MouseEvent) => void;
}

export function BookingBlock({
  slot,
  gridRowStart,
  gridRowEnd,
  gridColumnStart,
  gridColumnEnd,
  copyCount,
  onClick,
}: BookingBlockProps) {
  const status = slot.booking.status as BookingStatus;
  const statusLabel = BOOKING_STATUS_LABELS[status] ?? status;

  const isActive = status === BookingStatus.Active;
  const isReturned = status === BookingStatus.Returned;
  const colors =
    status === BookingStatus.Returned
      ? RETURNED_COLORS
      : status === BookingStatus.Overdue
        ? OVERDUE_COLORS
        : BLOCK_PALETTE[hashToIndex(slot.booking.customer_name)];

  const accentStatus = isActive || isReturned;
  const accentColor = isActive ? ACTIVE_ACCENT : isReturned ? RETURNED_ACCENT : undefined;

  return (
    <button
      data-booking-block
      onClick={onClick}
      className="relative rounded-md shadow-sm border cursor-pointer hover:shadow-md transition-shadow text-left overflow-hidden px-1.5 py-0.5 mx-1"
      style={{
        gridRow: `${gridRowStart} / ${gridRowEnd}`,
        gridColumn: `${gridColumnStart} / ${gridColumnEnd}`,
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: colors.border,
        borderLeftWidth: accentStatus ? 3 : undefined,
        borderLeftColor: accentColor,
        opacity: isReturned ? 0.8 : undefined,
      }}
      title={`${slot.booking.customer_name} — ${statusLabel}${copyCount > 1 ? ` (${copyCount}×)` : ''}`}
      aria-label={`Buchung: ${slot.booking.customer_name}, ${statusLabel}${copyCount > 1 ? `, ${copyCount} Exemplare` : ''}`}
    >
      <div className="text-[10px] opacity-75 truncate leading-tight">
        {slot.booking.expand?.customer
          ? `#${slot.booking.expand.customer.iid}`
          : '★'}
      </div>
      <div className="text-xs font-medium truncate leading-tight">
        {slot.booking.customer_name}
      </div>
      <div className="text-[10px] opacity-75 truncate leading-tight">
        {statusLabel}
      </div>
      {isActive && (
        <CircleCheckBig
          className="absolute top-4 left-4"
          style={{
            color: ACTIVE_ACCENT + 'aa',
            width: 22,
            height: 22,
            strokeWidth: 2.5,
            transform: 'rotate(-12deg)',
          }}
        />
      )}
      {isReturned && (
        <PackageCheck
          className="absolute top-4 left-4"
          style={{
            color: RETURNED_ACCENT,
            width: 22,
            height: 22,
            strokeWidth: 2.5,
            transform: 'rotate(-12deg)',
          }}
        />
      )}
      {copyCount > 1 && (
        <span
          className="absolute bottom-4 right-4 text-sm font-black leading-none tracking-tight rounded-md px-1.5 py-1 border-2"
          style={{
            color: colors.text + 'aa',
            borderColor: colors.text + '66',
            transform: 'rotate(-12deg)',
          }}
        >
          {copyCount}×
        </span>
      )}
    </button>
  );
}
