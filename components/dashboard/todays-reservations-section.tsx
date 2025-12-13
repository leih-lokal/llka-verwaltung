/**
 * Today's reservations section with complete-to-rental functionality
 */
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  ArrowsUpFromLine,
} from "lucide-react";
import { collections } from "@/lib/pocketbase/client";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { formatDateTime } from "@/lib/utils/formatting";
import type { Reservation, ReservationExpanded } from "@/types";
import { toast } from "sonner";
import Link from "next/link";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import { generateReservationPrintContent } from "@/components/print/reservation-print-content";

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
  useRealtimeSubscription<Reservation>("reservation", {
    onCreated: async (reservation) => {
      // Check if reservation is for today and not done
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);
      const pickupDate = parseISO(reservation.pickup);

      if (
        !reservation.done &&
        pickupDate >= startOfToday &&
        pickupDate <= endOfToday
      ) {
        try {
          const expandedReservation = await collections
            .reservations()
            .getOne<ReservationExpanded>(reservation.id, { expand: "items" });
          setReservations((prev) => {
            if (prev.some((r) => r.id === reservation.id)) return prev;
            return [...prev, expandedReservation].sort((a, b) =>
              a.customer_name.localeCompare(b.customer_name)
            );
          });
        } catch (err) {
          console.error("Error fetching expanded reservation:", err);
        }
      }
    },
    onUpdated: async (reservation) => {
      // Check if reservation is for today and not done
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);
      const pickupDate = parseISO(reservation.pickup);

      if (
        !reservation.done &&
        pickupDate >= startOfToday &&
        pickupDate <= endOfToday
      ) {
        try {
          const expandedReservation = await collections
            .reservations()
            .getOne<ReservationExpanded>(reservation.id, { expand: "items" });
          setReservations((prev) => {
            const updated = prev.map((r) =>
              r.id === reservation.id ? expandedReservation : r,
            );
            return updated.sort((a, b) =>
              a.customer_name.localeCompare(b.customer_name)
            );
          });
        } catch (err) {
          console.error("Error fetching expanded reservation:", err);
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
      const result = await collections
        .reservations()
        .getFullList<ReservationExpanded>({
          expand: "items",
          filter: `done = false && pickup >= "${startOfToday.toISOString()}" && pickup <= "${endOfToday.toISOString()}"`,
          sort: "customer_name",
        });

      setReservations(result);
    } catch (error) {
      console.error("Failed to load reservations:", error);
      toast.error("Fehler beim Laden der Reservierungen");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteReservation(reservation: ReservationExpanded) {
    // Redirect to rentals page with pre-filled data from reservation
    const params = new URLSearchParams({
      action: "new",
      from_reservation: reservation.id,
    });

    if (reservation.customer_iid) {
      params.set("customer_iid", reservation.customer_iid.toString());
    }

    // Pass item IIDs (not item IDs) so they can be looked up
    if (reservation.expand?.items && reservation.expand.items.length > 0) {
      const itemIids = reservation.expand.items.map((item) => item.iid).join(",");
      params.set("item_ids", itemIids);
    }

    window.location.href = `/rentals?${params.toString()}`;
  }

  async function handleMarkAsDone(reservationId: string) {
    if (!confirm("Reservierung als erledigt markieren?")) return;

    try {
      setCompletingId(reservationId);
      await collections.reservations().update(reservationId, { done: true });
      toast.success("Reservierung als erledigt markiert");
      loadReservations();
      onReservationCompleted?.();
    } catch (error) {
      console.error("Failed to mark reservation as done:", error);
      toast.error("Fehler beim Aktualisieren der Reservierung");
    } finally {
      setCompletingId(null);
    }
  }

  function handlePrint() {
    const htmlContent = generateReservationPrintContent(reservations);
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  }

  function ReservationItem({
    reservation,
  }: {
    reservation: ReservationExpanded;
  }) {
    const itemCount = reservation.items?.length || 0;

    // Get first item info
    const firstItem = reservation.expand?.items?.[0];
    const itemsText = firstItem
      ? `${String(firstItem.iid).padStart(4, "0")} ${firstItem.name}${itemCount > 1 ? ` +${itemCount - 1}` : ""}`
      : `${itemCount} ${itemCount === 1 ? "Gegenstand" : "Gegenstände"}`;

    return (
      <div className="flex items-center gap-3 p-2.5 rounded border bg-muted/30 hover:bg-muted/50 transition-colors text-sm">
        {/* Customer name with optional "Neu" badge */}
        <div className="flex items-center gap-1.5 min-w-[160px]">
          <span className="font-medium truncate">
            {reservation.customer_name}
          </span>
          {reservation.is_new_customer && (
            <Badge className="text-[10px] px-1.5 py-0.5">Neu</Badge>
          )}
        </div>

        {/* OTP - inline with red background */}
        {reservation.otp && (
          <div className="bg-red-100 border border-red-300 rounded px-2.5 py-1">
            <span className="font-mono font-bold text-red-600 tracking-wide">
              {reservation.otp}
            </span>
          </div>
        )}

        {/* Items info - flex to take remaining space */}
        <div className="flex-1 min-w-0 truncate text-muted-foreground">
          {itemsText}
        </div>

        {/* Action buttons - icons only, always visible */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="default"
            onClick={() => handleCompleteReservation(reservation)}
            disabled={completingId === reservation.id}
            className="h-8 w-8 p-0"
            title="In Ausleihe umwandeln"
          >
            <ArrowsUpFromLine className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleMarkAsDone(reservation.id)}
            disabled={completingId === reservation.id}
            className="h-8 w-8 p-0"
            title="Als erledigt markieren"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" asChild className="h-8 w-8 p-0">
            <Link href={`/reservations?view=${reservation.id}`} title="Details anzeigen">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Show comment indicator if present */}
        {reservation.comments && (
          <div className="text-muted-foreground" title={reservation.comments}>
            💬
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Lädt...</p>;
  }

  if (reservations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Reservierungen für heute geplant.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {reservations.map((reservation) => (
        <ReservationItem key={reservation.id} reservation={reservation} />
      ))}
    </div>
  );
}
