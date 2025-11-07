/**
 * Rentals page
 */

'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { collections } from '@/lib/pocketbase/client';
import type { RentalExpanded } from '@/types';
import { formatDate, calculateRentalStatus } from '@/lib/utils/formatting';
import { getRentalStatusLabel, RENTAL_STATUS_COLORS } from '@/lib/constants/statuses';

export default function RentalsPage() {
  const [rentals, setRentals] = useState<RentalExpanded[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRentals() {
      try {
        setIsLoading(true);
        const result = await collections.rentals().getList<RentalExpanded>(1, 50, {
          sort: '-created',
          expand: 'customer,items',
        });
        setRentals(result.items);
        setError(null);
      } catch (err) {
        console.error('Error fetching rentals:', err);
        setError(
          err instanceof Error ? err.message : 'Fehler beim Laden der Leihvorgänge'
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchRentals();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b-2 border-primary bg-background p-4 flex items-center gap-4">
        <Input
          placeholder="Leihvorgänge suchen..."
          className="max-w-md"
          disabled
        />
        <span className="text-sm text-muted-foreground ml-auto">
          {rentals.length} Leihvorgänge
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
        ) : rentals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Keine Leihvorgänge gefunden</p>
          </div>
        ) : (
          <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-primary">
                    <th className="px-4 py-2 text-left font-bold">Kunde</th>
                    <th className="px-4 py-2 text-left font-bold">Gegenstände</th>
                    <th className="px-4 py-2 text-left font-bold">Ausgeliehen</th>
                    <th className="px-4 py-2 text-left font-bold">Erwartet</th>
                    <th className="px-4 py-2 text-left font-bold">Zurück</th>
                    <th className="px-4 py-2 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rentals.map((rental) => {
                    const status = calculateRentalStatus(
                      rental.rented_on,
                      rental.returned_on,
                      rental.expected_on,
                      rental.extended_on
                    );
                    const statusColor = RENTAL_STATUS_COLORS[status];

                    return (
                      <tr
                        key={rental.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                        style={{ backgroundColor: statusColor }}
                      >
                        <td className="px-4 py-3">
                          {rental.expand?.customer ? (
                            <span className="font-medium">
                              {rental.expand.customer.firstname}{' '}
                              {rental.expand.customer.lastname}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {rental.expand?.items?.length > 0
                            ? rental.expand.items.map((item) => item.name).join(', ')
                            : `${rental.items.length} Gegenstände`}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(rental.rented_on)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(rental.extended_on || rental.expected_on)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {rental.returned_on ? formatDate(rental.returned_on) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">
                            {getRentalStatusLabel(status)}
                          </Badge>
                        </td>
                      </tr>
                    );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
