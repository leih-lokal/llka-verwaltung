/**
 * Overdue Rental Card
 * Individual rental card with quick actions
 */

'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  ExternalLinkIcon,
  PackageIcon,
  MessageSquareIcon,
} from 'lucide-react';
import type { RentalExpanded } from '@/types';
import { formatDate, formatFullName, calculateDaysOverdue } from '@/lib/utils/formatting';
import Link from 'next/link';
import { ExtendDialog } from './extend-dialog';

type SeverityVariant = 'severely_critical' | 'critical' | 'overdue' | 'due_today' | 'due_soon';

interface OverdueRentalCardProps {
  rental: RentalExpanded;
  variant: SeverityVariant;
  onUpdated: () => void;
}

const variantBgStyles: Record<SeverityVariant, string> = {
  severely_critical: 'bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-900',
  critical: 'bg-orange-50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900',
  overdue: 'bg-yellow-50 dark:bg-yellow-950/10 border-yellow-200 dark:border-yellow-900',
  due_today: 'bg-blue-50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900',
  due_soon: 'bg-gray-50 dark:bg-gray-950/10 border-gray-200 dark:border-gray-900',
};

export function OverdueRentalCard({ rental, variant, onUpdated }: OverdueRentalCardProps) {
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);

  const customerName = rental.expand?.customer
    ? formatFullName(rental.expand.customer.firstname, rental.expand.customer.lastname)
    : 'Unbekannt';

  const itemCount = rental.items?.length || 0;
  const firstItem = rental.expand?.items?.[0];
  const itemsText = firstItem
    ? `${String(firstItem.iid).padStart(4, '0')} ${firstItem.name}${itemCount > 1 ? ` +${itemCount - 1}` : ''}`
    : `${itemCount} ${itemCount === 1 ? 'Gegenstand' : 'Gegenstände'}`;

  const daysOverdue = calculateDaysOverdue(
    rental.returned_on,
    rental.expected_on,
    rental.extended_on
  );

  const isOverdue = daysOverdue > 0;

  return (
    <>
      <div
        className={`p-4 rounded-lg border ${variantBgStyles[variant]} transition-all hover:shadow-md`}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: Customer & Items Info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Customer */}
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-semibold text-base truncate">{customerName}</span>
              {rental.expand?.customer && (
                <Link
                  href={`/customers?view=${rental.expand.customer.id}`}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  target="_blank"
                >
                  Details
                  <ExternalLinkIcon className="h-3 w-3" />
                </Link>
              )}
            </div>

            {/* Items */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PackageIcon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{itemsText}</span>
            </div>

            {/* Dates */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Rückgabe:</span>
                <span className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                  {formatDate(rental.expected_on)}
                </span>
              </div>

              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  <ClockIcon className="h-3 w-3 mr-1" />
                  {daysOverdue} {daysOverdue === 1 ? 'Tag' : 'Tage'} überfällig
                </Badge>
              )}

              {!isOverdue && daysOverdue < 0 && (
                <Badge variant="outline" className="text-xs">
                  <ClockIcon className="h-3 w-3 mr-1" />
                  in {Math.abs(daysOverdue)} {Math.abs(daysOverdue) === 1 ? 'Tag' : 'Tagen'}
                </Badge>
              )}
            </div>

            {/* Remark */}
            {rental.remark && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground italic">
                <MessageSquareIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{rental.remark}</span>
              </div>
            )}
          </div>

          {/* Right: Quick Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {/* Extend */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExtendDialogOpen(true)}
              className="whitespace-nowrap"
            >
              Verlängern
            </Button>

            {/* View Rental */}
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="whitespace-nowrap"
            >
              <Link href={`/rentals?view=${rental.id}`}>
                Zur Ausleihe
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Extend Dialog */}
      <ExtendDialog
        open={extendDialogOpen}
        onOpenChange={setExtendDialogOpen}
        rental={rental}
        onSuccess={onUpdated}
      />
    </>
  );
}
