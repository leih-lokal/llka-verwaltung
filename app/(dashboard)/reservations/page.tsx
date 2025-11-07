/**
 * Reservations page
 */

'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { collections } from '@/lib/pocketbase/client';
import type { ReservationExpanded } from '@/types';
import { formatDateTime } from '@/lib/utils/formatting';

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<ReservationExpanded[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReservations() {
      try {
        setIsLoading(true);
        const result = await collections.reservations().getList<ReservationExpanded>(1, 50, {
          sort: '-created',
          expand: 'items',
        });
        setReservations(result.items);
        setError(null);
      } catch (err) {
        console.error('Error fetching reservations:', err);
        setError(
          err instanceof Error ? err.message : 'Fehler beim Laden der Reservierungen'
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchReservations();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b-2 border-primary bg-background p-4 flex items-center gap-4">
        <Input
          placeholder="Reservierungen suchen..."
          className="max-w-md"
          disabled
        />
        <span className="text-sm text-muted-foreground ml-auto">
          {reservations.length} Reservierungen
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive font-medium">Fehler: {error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Bitte überprüfen Sie Ihre PocketBase-Verbindung
            </p>
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Keine Reservierungen gefunden</p>
          </div>
        ) : (
          <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-primary">
                    <th className="px-4 py-2 text-left font-bold">Kunde</th>
                    <th className="px-4 py-2 text-left font-bold">Telefon</th>
                    <th className="px-4 py-2 text-left font-bold">Gegenstände</th>
                    <th className="px-4 py-2 text-left font-bold">Abholung</th>
                    <th className="px-4 py-2 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((reservation) => (
                    <tr
                      key={reservation.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium">
                            {reservation.customer_name}
                          </span>
                          {reservation.is_new_customer && (
                            <Badge variant="outline" className="ml-2">
                              Neukunde
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {reservation.customer_phone || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {reservation.expand?.items?.length > 0
                          ? reservation.expand.items.map((item) => item.name).join(', ')
                          : `${reservation.items.length} Gegenstände`}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDateTime(reservation.pickup)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={reservation.done ? 'default' : 'outline'}>
                          {reservation.done ? 'Erledigt' : 'Offen'}
                        </Badge>
                      </td>
                    </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
