/**
 * Today's reservations section with complete-to-rental functionality
 */
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle2, ExternalLink, ArrowRight, Printer } from 'lucide-react';
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

  function handlePrint() {
    window.print();
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
        {/* OTP Display - Prominent */}
        {reservation.otp && (
          <div className="mb-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-md p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-blue-600 uppercase">
                Abholcode
              </span>
              <div className="bg-white rounded px-3 py-1 shadow-sm">
                <span className="text-2xl font-bold font-mono tracking-wider text-blue-600">
                  {reservation.otp}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm truncate">
                {reservation.customer_name}
              </span>
              {reservation.is_new_customer && (
                <Badge className="text-xs">
                  Neu
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              Abholung: {formatDateTime(reservation.pickup)}
            </p>
            <p className="text-xs truncate">
              {itemsText}
            </p>
            {reservation.comments && (
              <p className="text-xs text-muted-foreground mt-1 italic">
                "{reservation.comments}"
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
    <>
      {/* Print styles to hide everything except our print layout */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #reservation-print-root,
            #reservation-print-root * {
              visibility: visible !important;
            }
            #reservation-print-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
            }
          }
        `
      }} />

      {/* Regular display (hidden during print) */}
      <Card className="print:hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <span>Heutige Reservierungen</span>
            </CardTitle>
            {!loading && reservations.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 mr-2" />
                Drucken
              </Button>
            )}
          </div>
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

      {/* Print-only layout */}
      <div id="reservation-print-root" className="hidden print:block fixed inset-0 bg-white p-8 z-[9999]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Heutige Reservierungen</h1>
          <p className="text-sm text-gray-600">{formatDate(new Date())}</p>
        </div>

        <div className="space-y-6">
          {reservations.map((reservation, index) => (
            <div key={reservation.id} className="border-b pb-4 mb-4">
              <div className="flex items-start gap-3 mb-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 print:appearance-auto"
                  disabled
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-base">
                      {index + 1}. {reservation.customer_name}
                    </span>
                    {reservation.is_new_customer && (
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        Neukunde
                      </span>
                    )}
                  </div>

                  {/* OTP Display - Prominent in Print */}
                  {reservation.otp && (
                    <div className="my-2 border-2 border-blue-300 bg-blue-50 rounded p-3 inline-block">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-blue-600 uppercase">
                          Abholcode:
                        </span>
                        <span className="text-3xl font-bold font-mono tracking-widest text-blue-600">
                          {reservation.otp}
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-gray-600 mb-1">
                    Abholung: {formatDateTime(reservation.pickup)}
                  </p>
                  {reservation.comments && (
                    <p className="text-sm text-gray-600 italic mb-2">
                      Kommentar: "{reservation.comments}"
                    </p>
                  )}

                  {/* Items checklist */}
                  {reservation.expand?.items && reservation.expand.items.length > 0 && (
                    <div className="ml-8 mt-2 space-y-1">
                      <p className="text-sm font-medium mb-2">Gegenstände:</p>
                      {reservation.expand.items.map((item) => (
                        <div key={item.id} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 print:appearance-auto"
                            disabled
                          />
                          <span className="text-sm">
                            {String(item.iid).padStart(4, '0')} - {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {reservations.length === 0 && (
          <p className="text-gray-500">Keine Reservierungen für heute geplant.</p>
        )}
      </div>
    </>
  );
}
