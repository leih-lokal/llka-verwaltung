/**
 * Due This Week Widget
 * Shows rentals due in the next 7 days
 */
'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import { collections } from '@/lib/pocketbase/client';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import type { Rental, RentalExpanded, DueThisWeekItem } from '@/types';
import { getRentalsDueInDays } from '@/lib/utils/dashboard-metrics';
import { formatDate } from '@/lib/utils/formatting';
import { toast } from 'sonner';
import Link from 'next/link';

export function DueThisWeekSection() {
  const [rentals, setRentals] = useState<RentalExpanded[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueItems, setDueItems] = useState<DueThisWeekItem[]>([]);

  useEffect(() => {
    loadRentals();
  }, []);

  // Real-time subscription for live updates
  useRealtimeSubscription<Rental>('rental', {
    onCreated: async (rental) => {
      // Only fetch if not returned
      if (!rental.returned_on) {
        try {
          const expandedRental = await collections
            .rentals()
            .getOne<RentalExpanded>(rental.id, { expand: 'customer,items' });
          setRentals((prev) => {
            if (prev.some((r) => r.id === rental.id)) return prev;
            return [...prev, expandedRental];
          });
        } catch (err) {
          console.error('Error fetching expanded rental:', err);
        }
      }
    },
    onUpdated: async (rental) => {
      if (!rental.returned_on) {
        try {
          const expandedRental = await collections
            .rentals()
            .getOne<RentalExpanded>(rental.id, { expand: 'customer,items' });
          setRentals((prev) =>
            prev.map((r) => (r.id === rental.id ? expandedRental : r))
          );
        } catch (err) {
          console.error('Error fetching expanded rental:', err);
        }
      } else {
        // Remove from list if returned
        setRentals((prev) => prev.filter((r) => r.id !== rental.id));
      }
    },
    onDeleted: (rental) => {
      setRentals((prev) => prev.filter((r) => r.id !== rental.id));
    },
  });

  // Recalculate due items whenever rentals change
  useEffect(() => {
    const items = getRentalsDueInDays(rentals, 7);
    setDueItems(items);
  }, [rentals]);

  async function loadRentals() {
    try {
      setLoading(true);

      // Get all active rentals (not returned)
      const result = await collections.rentals().getFullList<RentalExpanded>({
        expand: 'customer,items',
        filter: 'returned_on = ""',
      });

      setRentals(result);
    } catch (error) {
      console.error('Failed to load rentals:', error);
      toast.error('Fehler beim Laden der Ausleihen');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Get badge variant based on days until due
   */
  function getDueBadge(daysUntilDue: number) {
    if (daysUntilDue === 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          Heute
        </Badge>
      );
    }
    if (daysUntilDue === 1) {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-xs">
          Morgen
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs">
        {daysUntilDue} {daysUntilDue === 1 ? 'Tag' : 'Tage'}
      </Badge>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Lädt...</p>;
  }

  if (dueItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Keine Ausleihen diese Woche fällig
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Die nächsten 7 Tage sind frei
        </p>
      </div>
    );
  }

  // Show first 10 items
  const displayedItems = dueItems.slice(0, 10);
  const hasMore = dueItems.length > 10;

  return (
    <div className="space-y-2">
      {/* Scrollable list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {displayedItems.map((item) => {
          const firstItem = item.rental.expand?.items?.[0];
          const itemsText = firstItem
            ? `${String(firstItem.iid).padStart(4, '0')} ${firstItem.name}${
                item.itemCount > 1 ? ` +${item.itemCount - 1}` : ''
              }`
            : `${item.itemCount} ${
                item.itemCount === 1 ? 'Gegenstand' : 'Gegenstände'
              }`;

          return (
            <Link
              key={item.rental.id}
              href={`/rentals?view=${item.rental.id}`}
              className="block"
            >
              <div className="p-3 rounded border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-medium text-sm truncate">
                    {item.customerName}
                  </div>
                  {getDueBadge(item.daysUntilDue)}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {itemsText}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Fällig: {formatDate(item.dueDate)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* "More" indicator */}
      {hasMore && (
        <p className="text-xs text-center text-muted-foreground pt-2 border-t">
          + {dueItems.length - 10} weitere Ausleihen
        </p>
      )}
    </div>
  );
}
