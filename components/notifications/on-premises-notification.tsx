/**
 * On-Premises Reservation Notification
 * Shows a large, prominent notification when an on-premises reservation is created or updated
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, MapPin, Package, User, Clock } from 'lucide-react';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import { collections, pb } from '@/lib/pocketbase/client';
import { formatDateTime } from '@/lib/utils/formatting';
import type { Reservation, ReservationExpanded } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function OnPremisesNotification() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<ReservationExpanded[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element (public/ files live under the basePath)
  useEffect(() => {
    audioRef.current = new Audio(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/alert_simple.mp3`);
    // Preload the audio
    audioRef.current.load();
  }, []);

  // Play notification sound
  const playSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // Reset to start
      audioRef.current.play().catch((err) => {
        console.error('Failed to play notification sound:', err);
      });
    }
  };

  // `updated` of the last notification per reservation, so a catch-up doesn't
  // repeat one that was already shown
  const notifiedRef = useRef(new Map<string, string>());
  // Time up to which reservation changes have been seen (set on mount, on
  // every event and on every catch-up)
  const seenUntilRef = useRef<Date | null>(null);

  useEffect(() => {
    seenUntilRef.current = new Date();
  }, []);

  // Show notification for an on-premises reservation (expanded items)
  const addNotification = (reservation: ReservationExpanded) => {
    notifiedRef.current.set(reservation.id, reservation.updated);

    // Replace an earlier notification for the same reservation (updates
    // re-notify) instead of stacking a duplicate with the same key
    setNotifications((prev) => [
      reservation,
      ...prev.filter((n) => n.id !== reservation.id),
    ]);
    playSound();

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      dismissNotification(reservation.id);
    }, 30000);
  };

  // Show notification for on-premises reservation
  const showNotification = async (reservation: Reservation) => {
    try {
      // Fetch full reservation with expanded items
      const expandedReservation = await collections.reservations().getOne<ReservationExpanded>(
        reservation.id,
        { expand: 'items' }
      );
      addNotification(expandedReservation);
    } catch (err) {
      console.error('Error fetching reservation details:', err);
    }
  };

  // Dismiss notification
  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Notify about open on-premises reservations changed while the
  // subscription was paused or disconnected (at most the 10 latest)
  const catchUp = async () => {
    const since = seenUntilRef.current;
    seenUntilRef.current = new Date();
    if (!since) return;

    const { items } = await collections.reservations().getList<ReservationExpanded>(1, 10, {
      filter: pb.filter('on_premises = true && done = false && updated >= {:since}', { since }),
      expand: 'items',
      sort: 'updated',
      skipTotal: true,
    });
    for (const reservation of items) {
      if (notifiedRef.current.get(reservation.id) !== reservation.updated) {
        addNotification(reservation);
      }
    }
  };

  // Subscribe to reservation changes
  useRealtimeSubscription<Reservation>('reservation', {
    onCreated: async (reservation) => {
      seenUntilRef.current = new Date();
      // Show notification if on_premises is true
      if (reservation.on_premises) {
        await showNotification(reservation);
      }
    },
    onUpdated: async (reservation) => {
      seenUntilRef.current = new Date();
      // Show notification if on_premises changed from false to true
      // or if it's already on_premises (re-notification)
      if (reservation.on_premises) {
        // Check if this is a change to on_premises = true
        // We'll show it regardless to catch terminal pickups
        await showNotification(reservation);
      }
    },
    // Terminal pickups announced while paused or disconnected
    onResubscribe: catchUp,
  });

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3 w-full max-w-md pointer-events-none">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          role="alert"
          className="pointer-events-auto focus-ring-light bg-linear-to-tl from-red-800 to-red-700 text-white rounded-lg shadow-2xl border-2 border-white animate-in slide-in-from-right-5 duration-300"
        >
          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 p-2 rounded-full">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Abholung vor Ort!</h3>
                  <p className="text-sm text-white/90">Terminal-Reservierung</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-white hover:bg-white/20 -mt-1 -mr-1"
                onClick={() => dismissNotification(notification.id)}
                aria-label="Benachrichtigung schließen"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            {/* OTP - Most Prominent */}
            {notification.otp && (
              <div className="bg-white rounded-lg p-4 mb-3">
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-600 mb-1">ABHOLCODE</p>
                  <p className="text-4xl font-bold font-mono tracking-widest text-gray-900">
                    {notification.otp}
                  </p>
                </div>
              </div>
            )}

            {/* Customer Info */}
            <div className="space-y-2 mb-3 bg-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">{notification.customer_name}</p>
                  {notification.customer_phone && (
                    <p className="text-sm text-white/90">{notification.customer_phone}</p>
                  )}
                </div>
                {notification.is_new_customer && (
                  <Badge className="bg-yellow-400 text-yellow-900 border-0">
                    Neunutzer
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-white/90">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>Abholung: {formatDateTime(notification.pickup)}</span>
              </div>
            </div>

            {/* Items */}
            {notification.expand?.items && notification.expand.items.length > 0 && (
              <div className="bg-white/10 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4" />
                  <p className="text-sm font-semibold">
                    Gegenstände ({notification.expand.items.length})
                  </p>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {notification.expand.items.map((item) => (
                    <div
                      key={item.id}
                      className="text-sm flex items-center gap-2 text-white/90"
                    >
                      <span className="font-mono font-semibold">
                        #{String(item.iid).padStart(4, '0')}
                      </span>
                      <span className="truncate">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            {notification.comments && (
              <div className="mt-3 bg-white/10 rounded-lg p-3">
                <p className="text-sm italic text-white/90">„{notification.comments}“</p>
              </div>
            )}

            {/* Action */}
            <div className="mt-4">
              <Button
                className="w-full bg-white text-red-700 hover:bg-white/90 font-semibold"
                onClick={() => router.push(`/reservations?view=${notification.id}`)}
              >
                Details anzeigen
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
