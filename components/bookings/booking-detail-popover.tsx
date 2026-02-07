/**
 * Popover showing booking details with delete and convert-to-rental actions
 */

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2Icon, ArrowRightIcon, EyeIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { collections } from '@/lib/pocketbase/client';
import { BookingStatus } from '@/types';
import type { BookingExpanded } from '@/types';
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_TEXT_COLORS,
} from '@/lib/constants/statuses';
import { FormattedId } from '@/components/ui/formatted-id';

interface BookingDetailPopoverProps {
  booking: BookingExpanded | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorPosition: { x: number; y: number } | null;
  onChanged?: () => void;
  onConvertToRental?: (booking: BookingExpanded) => void;
}

function formatDate(dateStr: string): string {
  const d = dateStr.split(' ')[0] || dateStr.split('T')[0];
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

export function BookingDetailPopover({
  booking,
  open,
  onOpenChange,
  anchorPosition,
  onChanged,
  onConvertToRental,
}: BookingDetailPopoverProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!booking) return null;

  const status = booking.status as BookingStatus;
  const itemName = booking.expand?.item?.name || 'Unbekannt';
  const itemIid = booking.expand?.item?.iid;
  const customerIid = booking.expand?.customer?.iid;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await collections.bookings().delete(booking.id);
      toast.success('Buchung gelöscht');
      onChanged?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Error deleting booking:', err);
      toast.error('Fehler beim Löschen');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor
        className="fixed pointer-events-none w-0 h-0"
        style={{
          left: anchorPosition?.x ?? 0,
          top: anchorPosition?.y ?? 0,
        }}
      />
      <PopoverContent
        className="w-72 p-0"
        side="right"
        align="start"
        sideOffset={8}
      >
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-sm truncate">
              {customerIid != null ? (
                <span className="text-muted-foreground mr-1">#{customerIid}</span>
              ) : (
                <span className="mr-1">★</span>
              )}
              {booking.customer_name}
            </div>
            <Badge
              className="shrink-0 text-[10px] px-1.5 py-0"
              style={{
                backgroundColor: BOOKING_STATUS_COLORS[status],
                color: BOOKING_STATUS_TEXT_COLORS[status],
              }}
            >
              {BOOKING_STATUS_LABELS[status]}
            </Badge>
          </div>

          {/* Details */}
          <div className="text-xs space-y-1 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              {itemIid != null && <FormattedId id={itemIid} size="sm" />}
              <span>{itemName}</span>
            </div>
            <div>
              {formatDate(booking.start_date)} — {formatDate(booking.end_date)}
            </div>
            {booking.customer_phone && (
              <div>{booking.customer_phone}</div>
            )}
            {booking.notes && (
              <div className="italic">{booking.notes}</div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2Icon className="h-3 w-3 mr-1" />
              Löschen
            </Button>
            {booking.associated_rental ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => {
                  onConvertToRental?.(booking);
                  onOpenChange(false);
                }}
              >
                <EyeIcon className="h-3 w-3 mr-1" />
                Ausleihe anzeigen
              </Button>
            ) : status === BookingStatus.Reserved && (
              <Button
                variant="default"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => {
                  onConvertToRental?.(booking);
                  onOpenChange(false);
                }}
              >
                <ArrowRightIcon className="h-3 w-3 mr-1" />
                Ausleihe
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
