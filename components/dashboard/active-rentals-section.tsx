/**
 * Active rentals section showing overdue and due today rentals
 */
'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { useUnreturnedRentals } from '@/hooks/use-unreturned-rentals';
import { calculateRentalStatus, formatDate, formatFullName } from '@/lib/utils/formatting';
import type { RentalExpanded } from '@/types';
import { RentalStatus } from '@/types';
import Link from 'next/link';

interface ActiveRentalsSectionProps {
  onRentalReturned?: () => void;
}

export function ActiveRentalsSection({ onRentalReturned }: ActiveRentalsSectionProps) {
  const { rentals, loading } = useUnreturnedRentals();

  // Categorize rentals by status (the list is ordered by expected_on)
  const { overdueRentals, dueTodayRentals, activeRentals } = useMemo(() => {
    const overdue: RentalExpanded[] = [];
    const dueToday: RentalExpanded[] = [];
    const active: RentalExpanded[] = [];

    rentals.forEach((rental) => {
      const status = calculateRentalStatus(
        rental.rented_on,
        rental.returned_on,
        rental.expected_on,
        rental.extended_on
      );

      if (status === RentalStatus.Overdue) {
        overdue.push(rental);
      } else if (status === RentalStatus.DueToday) {
        dueToday.push(rental);
      } else {
        active.push(rental);
      }
    });

    return { overdueRentals: overdue, dueTodayRentals: dueToday, activeRentals: active };
  }, [rentals]);

  function RentalItem({ rental, variant }: { rental: RentalExpanded; variant: 'overdue' | 'duetoday' | 'active' }) {
    const customerName = rental.expand?.customer
      ? formatFullName(rental.expand.customer.firstname, rental.expand.customer.lastname)
      : 'Unbekannt';

    const itemCount = rental.items?.length || 0;
    // Use expected_on for due date (extended_on is now just a timestamp of when extension was made)
    const dueDate = rental.expected_on;

    // Get first item info
    const firstItem = rental.expand?.items?.[0];
    const itemsText = firstItem
      ? `${String(firstItem.iid).padStart(4, '0')} ${firstItem.name}${itemCount > 1 ? ` +${itemCount - 1}` : ''}`
      : `${itemCount} ${itemCount === 1 ? 'Gegenstand' : 'Gegenstände'}`;

    return (
      <div
        className={`p-2 rounded-lg border ${
          variant === 'overdue'
            ? 'bg-red-50 border-red-200'
            : variant === 'duetoday'
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-muted/50'
        }`}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-medium text-sm truncate">
                {customerName}
              </span>
              {variant === 'overdue' && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  Überfällig
                </Badge>
              )}
              {variant === 'duetoday' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-600 text-yellow-600">
                  Heute fällig
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {itemsText} • Rückgabe: {formatDate(dueDate)}
            </p>
          </div>
          <Button size="sm" variant="ghost" asChild className="shrink-0 h-8 w-8 p-0">
            <Link href={`/rentals?view=${rental.id}`}>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Lädt...</p>;
  }

  if (
    overdueRentals.length === 0 &&
    dueTodayRentals.length === 0 &&
    activeRentals.length === 0
  ) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine aktiven Ausleihen vorhanden.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overdue Rentals */}
      {overdueRentals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">
              Überfällig ({overdueRentals.length})
            </h3>
          </div>
          <div className="space-y-2">
            {overdueRentals.map((rental) => (
              <RentalItem key={rental.id} rental={rental} variant="overdue" />
            ))}
          </div>
        </div>
      )}

      {/* Due Today Rentals */}
      {dueTodayRentals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <h3 className="text-sm font-semibold text-yellow-600">
              Heute fällig ({dueTodayRentals.length})
            </h3>
          </div>
          <div className="space-y-2">
            {dueTodayRentals.map((rental) => (
              <RentalItem key={rental.id} rental={rental} variant="duetoday" />
            ))}
          </div>
        </div>
      )}

      {/* Active Rentals */}
      {activeRentals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">
            Weitere Ausleihen ({activeRentals.length})
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {activeRentals.slice(0, 10).map((rental) => (
              <RentalItem key={rental.id} rental={rental} variant="active" />
            ))}
            {activeRentals.length > 10 && (
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link href="/rentals">
                  Alle {activeRentals.length} Ausleihen anzeigen
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
