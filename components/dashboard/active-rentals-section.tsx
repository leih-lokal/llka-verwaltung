/**
 * Active rentals section showing overdue and due today rentals
 */
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { collections } from '@/lib/pocketbase/client';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import { calculateRentalStatus, formatDate, formatFullName } from '@/lib/utils/formatting';
import type { Rental, RentalExpanded } from '@/types';
import { RentalStatus } from '@/types';
import { toast } from 'sonner';
import Link from 'next/link';

interface ActiveRentalsSectionProps {
  onRentalReturned?: () => void;
}

export function ActiveRentalsSection({ onRentalReturned }: ActiveRentalsSectionProps) {
  const [overdueRentals, setOverdueRentals] = useState<RentalExpanded[]>([]);
  const [dueTodayRentals, setDueTodayRentals] = useState<RentalExpanded[]>([]);
  const [activeRentals, setActiveRentals] = useState<RentalExpanded[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRentals();
  }, []);

  // Real-time subscription for live updates
  useRealtimeSubscription<Rental>('rentals', {
    onCreated: async (rental) => {
      // Only handle active rentals (not returned)
      if (rental.returned_on) return;

      try {
        const expandedRental = await collections.rentals().getOne<RentalExpanded>(
          rental.id,
          { expand: 'customer,items' }
        );

        const status = calculateRentalStatus(
          expandedRental.rented_on,
          expandedRental.returned_on,
          expandedRental.expected_on,
          expandedRental.extended_on
        );

        if (status === RentalStatus.Overdue) {
          setOverdueRentals((prev) => {
            if (prev.some((r) => r.id === rental.id)) return prev;
            return [expandedRental, ...prev];
          });
        } else if (status === RentalStatus.DueToday) {
          setDueTodayRentals((prev) => {
            if (prev.some((r) => r.id === rental.id)) return prev;
            return [expandedRental, ...prev];
          });
        } else {
          setActiveRentals((prev) => {
            if (prev.some((r) => r.id === rental.id)) return prev;
            return [expandedRental, ...prev];
          });
        }
      } catch (err) {
        console.error('Error fetching expanded rental:', err);
      }
    },
    onUpdated: async (rental) => {
      try {
        const expandedRental = await collections.rentals().getOne<RentalExpanded>(
          rental.id,
          { expand: 'customer,items' }
        );

        // If returned, remove from all lists
        if (expandedRental.returned_on) {
          setOverdueRentals((prev) => prev.filter((r) => r.id !== rental.id));
          setDueTodayRentals((prev) => prev.filter((r) => r.id !== rental.id));
          setActiveRentals((prev) => prev.filter((r) => r.id !== rental.id));
          return;
        }

        // Recalculate status and move to correct category
        const status = calculateRentalStatus(
          expandedRental.rented_on,
          expandedRental.returned_on,
          expandedRental.expected_on,
          expandedRental.extended_on
        );

        // Remove from all lists first
        setOverdueRentals((prev) => prev.filter((r) => r.id !== rental.id));
        setDueTodayRentals((prev) => prev.filter((r) => r.id !== rental.id));
        setActiveRentals((prev) => prev.filter((r) => r.id !== rental.id));

        // Add to correct list
        if (status === RentalStatus.Overdue) {
          setOverdueRentals((prev) => [expandedRental, ...prev]);
        } else if (status === RentalStatus.DueToday) {
          setDueTodayRentals((prev) => [expandedRental, ...prev]);
        } else {
          setActiveRentals((prev) => [expandedRental, ...prev]);
        }
      } catch (err) {
        console.error('Error fetching expanded rental:', err);
      }
    },
    onDeleted: (rental) => {
      // Remove from all lists
      setOverdueRentals((prev) => prev.filter((r) => r.id !== rental.id));
      setDueTodayRentals((prev) => prev.filter((r) => r.id !== rental.id));
      setActiveRentals((prev) => prev.filter((r) => r.id !== rental.id));
    },
  });

  async function loadRentals() {
    try {
      setLoading(true);
      const result = await collections.rentals().getFullList<RentalExpanded>({
        expand: 'customer,items',
        filter: 'returned_on = ""',
        sort: 'expected_on',
      });

      // Categorize rentals by status
      const overdue: RentalExpanded[] = [];
      const dueToday: RentalExpanded[] = [];
      const active: RentalExpanded[] = [];

      result.forEach((rental) => {
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

      setOverdueRentals(overdue);
      setDueTodayRentals(dueToday);
      setActiveRentals(active);
    } catch (error) {
      console.error('Failed to load rentals:', error);
      toast.error('Fehler beim Laden der Ausleihen');
    } finally {
      setLoading(false);
    }
  }

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
        className={`p-3 rounded-lg border ${
          variant === 'overdue'
            ? 'bg-red-50 border-red-200'
            : variant === 'duetoday'
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-muted/50'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm truncate">
                {customerName}
              </span>
              {variant === 'overdue' && (
                <Badge variant="destructive" className="text-xs">
                  Überfällig
                </Badge>
              )}
              {variant === 'duetoday' && (
                <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-600">
                  Heute fällig
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {itemsText} • Rückgabe: {formatDate(dueDate)}
            </p>
          </div>
          <Button size="sm" variant="ghost" asChild className="shrink-0">
            <Link href={`/rentals?view=${rental.id}`}>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          <span>Aktive Ausleihen</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Lädt...</p>
        ) : (
          <>
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

            {/* No Active Rentals */}
            {overdueRentals.length === 0 &&
              dueTodayRentals.length === 0 &&
              activeRentals.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Keine aktiven Ausleihen vorhanden.
                </p>
              )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
