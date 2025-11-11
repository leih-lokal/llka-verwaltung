/**
 * Today's reservations section with complete-to-rental functionality
 */
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle2, ExternalLink, ArrowRight } from 'lucide-react';
import { collections } from '@/lib/pocketbase/client';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import { formatDate, formatDateTime } from '@/lib/utils/formatting';
import type { Reservation, ReservationExpanded } from '@/types';
import { toast } from 'sonner';
import Link from 'next/link';
import { parseISO, startOfDay, endOfDay } from 'date-fns';

interface TodaysReservationsSectionProps {
  onReservationCompleted?: () => void;
}

export function TodaysReservationsSection({
  onReservationCompleted,
}: TodaysReservationsSectionProps) {
  const [reservations, setReservations] = useState<ReservationExpanded[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    loadReservations();
  }, []);

  // Real-time subscription for live updates
  useRealtimeSubscription<Reservation>('reservation', {
    onCreated: async (reservation) => {
      // Check if reservation is for today and not done
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);
      const pickupDate = parseISO(reservation.pickup);

      if (!reservation.done && pickupDate >= startOfToday && pickupDate <= endOfToday) {
        try {
          const expandedReservation = await collections.reservations().getOne<ReservationExpanded>(
            reservation.id,
            { expand: 'items' }
          );
          setReservations((prev) => {
            if (prev.some((r) => r.id === reservation.id)) return prev;
            return [...prev, expandedReservation].sort((a, b) =>
              new Date(a.pickup).getTime() - new Date(b.pickup).getTime()
            );
          });
        } catch (err) {
          console.error('Error fetching expanded reservation:', err);
        }
      }
    },
    onUpdated: async (reservation) => {
      // Check if reservation is for today and not done
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);
      const pickupDate = parseISO(reservation.pickup);

      if (!reservation.done && pickupDate >= startOfToday && pickupDate <= endOfToday) {
        try {
          const expandedReservation = await collections.reservations().getOne<ReservationExpanded>(
            reservation.id,
            { expand: 'items' }
          );
          setReservations((prev) => {
            const updated = prev.map((r) => (r.id === reservation.id ? expandedReservation : r));
            return updated.sort((a, b) =>
              new Date(a.pickup).getTime() - new Date(b.pickup).getTime()
            );
          });
        } catch (err) {
          console.error('Error fetching expanded reservation:', err);
        }
      } else {
        // Remove from list if marked as done or not for today
        setReservations((prev) => prev.filter((r) => r.id !== reservation.id));
      }
    },
    onDeleted: (reservation) => {
      setReservations((prev) => prev.filter((r) => r.id !== reservation.id));
    },
  });

  async function loadReservations() {
    try {
      setLoading(true);

      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      // Get reservations for today that are not done
      const result = await collections.reservations().getFullList<ReservationExpanded>({
        expand: 'items',
        filter: `done = false && pickup >= "${startOfToday.toISOString()}" && pickup <= "${endOfToday.toISOString()}"`,
        sort: 'pickup',
      });

      setReservations(result);
    } catch (error) {
      console.error('Failed to load reservations:', error);
      toast.error('Fehler beim Laden der Reservierungen');
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteReservation(reservation: ReservationExpanded) {
    // Redirect to rentals page with pre-filled data from reservation
    const params = new URLSearchParams({
      action: 'new',
      from_reservation: reservation.id,
    });

    if (reservation.customer_iid) {
      params.set('customer_iid', reservation.customer_iid.toString());
    }

    if (reservation.items && reservation.items.length > 0) {
      params.set('item_ids', reservation.items.join(','));
    }

    window.location.href = `/rentals?${params.toString()}`;
  }

  async function handleMarkAsDone(reservationId: string) {
    if (!confirm('Reservierung als erledigt markieren?')) return;

    try {
      setCompletingId(reservationId);
      await collections.reservations().update(reservationId, { done: true });
      toast.success('Reservierung als erledigt markiert');
      loadReservations();
      onReservationCompleted?.();
    } catch (error) {
      console.error('Failed to mark reservation as done:', error);
      toast.error('Fehler beim Aktualisieren der Reservierung');
    } finally {
      setCompletingId(null);
    }
  }

  function ReservationItem({ reservation }: { reservation: ReservationExpanded }) {
    const itemCount = reservation.items?.length || 0;

    // Get first item info
    const firstItem = reservation.expand?.items?.[0];
    const itemsText = firstItem
      ? `${String(firstItem.iid).padStart(4, '0')} ${firstItem.name}${itemCount > 1 ? ` +${itemCount - 1}` : ''}`
      : `${itemCount} ${itemCount === 1 ? 'Gegenstand' : 'Gegenstände'}`;

    return (
      <div className="p-3 rounded-lg border bg-muted/50">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm truncate">
                {reservation.customer_name}
              </span>
              {reservation.is_new_customer && (
                <Badge variant="secondary" className="text-xs">
                  Neu
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              Abholung: {formatDateTime(reservation.pickup)}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {itemsText}
            </p>
            {reservation.comments && (
              <p className="text-xs text-muted-foreground mt-1 italic">
                "{reservation.comments}"
              </p>
            )}
            {(reservation.customer_phone || reservation.customer_email) && (
              <p className="text-xs text-muted-foreground mt-1">
                {reservation.customer_phone && `📞 ${reservation.customer_phone}`}
                {reservation.customer_phone && reservation.customer_email && ' • '}
                {reservation.customer_email && `✉️ ${reservation.customer_email}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => handleCompleteReservation(reservation)}
            disabled={completingId === reservation.id}
            className="flex-1"
          >
            <ArrowRight className="mr-1 h-3 w-3" />
            In Ausleihe umwandeln
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleMarkAsDone(reservation.id)}
            disabled={completingId === reservation.id}
          >
            <CheckCircle2 className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/reservations?view=${reservation.id}`}>
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
          <Calendar className="h-5 w-5" />
          <span>Heutige Reservierungen</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Lädt...</p>
        ) : reservations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Reservierungen für heute geplant.
          </p>
        ) : (
          <div className="space-y-3">
            {reservations.map((reservation) => (
              <ReservationItem key={reservation.id} reservation={reservation} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
