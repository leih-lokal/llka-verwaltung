/**
 * Customers page
 */

'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { collections } from '@/lib/pocketbase/client';
import type { Customer } from '@/types';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        setIsLoading(true);
        const result = await collections.customers().getList<Customer>(1, 50, {
          sort: '-created',
        });
        setCustomers(result.items);
        setError(null);
      } catch (err) {
        console.error('Error fetching customers:', err);
        setError(
          err instanceof Error ? err.message : 'Fehler beim Laden der Kund:innen'
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchCustomers();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b-2 border-primary bg-background p-4 flex items-center gap-4">
        <Input
          placeholder="Kund:innen suchen..."
          className="max-w-md"
          disabled
        />
        <span className="text-sm text-muted-foreground ml-auto">
          {customers.length} Kund:innen
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
          ) : customers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Keine Kund:innen gefunden</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-primary">
                  <th className="px-4 py-2 text-left font-bold">ID</th>
                  <th className="px-4 py-2 text-left font-bold">Name</th>
                  <th className="px-4 py-2 text-left font-bold">Email</th>
                  <th className="px-4 py-2 text-left font-bold">Telefon</th>
                  <th className="px-4 py-2 text-left font-bold">Stadt</th>
                  <th className="px-4 py-2 text-left font-bold">
                    Registriert
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-sm">
                      {customer.iid}
                    </td>
                    <td className="px-4 py-3">
                      {customer.firstname} {customer.lastname}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {customer.email || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {customer.phone || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {customer.city || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(customer.registered_on).toLocaleDateString(
                        'de-DE'
                      )}
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
