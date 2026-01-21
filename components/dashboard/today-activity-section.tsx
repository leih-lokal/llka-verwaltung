/**
 * Today's Activity Widget
 * Shows daily activity summary: checkouts, returns, new customers, reservations
 * Uses efficient count queries instead of fetching all records
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Package, CheckCircle, Users, Calendar } from 'lucide-react';
import { collections } from '@/lib/pocketbase/client';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import { useSettings } from '@/hooks/use-settings';
import type { Rental, Customer, Reservation } from '@/types';
import { toast } from 'sonner';

interface TodayCounts {
  checkouts: number;
  returns: number;
  newCustomers: number;
  newReservations: number;
}

export function TodayActivitySection() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<TodayCounts>({
    checkouts: 0,
    returns: 0,
    newCustomers: 0,
    newReservations: 0,
  });
  const { settings } = useSettings();

  const loadCounts = useCallback(async () => {
    try {
      setLoading(true);

      // Get today's date at midnight in local timezone, formatted for PocketBase
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().replace('T', ' ').substring(0, 19);

      // Build queries array - only include reservations if enabled
      const queries = [
        // Rentals created today (checkouts)
        collections.rentals().getList(1, 1, {
          filter: `rented_on >= '${todayStr}'`,
        }),
        // Returns today
        collections.rentals().getList(1, 1, {
          filter: `returned_on >= '${todayStr}'`,
        }),
        // New customers registered today
        collections.customers().getList(1, 1, {
          filter: `registered_on >= '${todayStr}'`,
        }),
      ];

      // Only query reservations if enabled
      if (settings.reservations_enabled) {
        queries.push(
          collections.reservations().getList(1, 1, {
            filter: `created >= '${todayStr}'`,
          })
        );
      }

      const results = await Promise.all(queries);

      setCounts({
        checkouts: results[0].totalItems,
        returns: results[1].totalItems,
        newCustomers: results[2].totalItems,
        newReservations: settings.reservations_enabled ? results[3].totalItems : 0,
      });
    } catch (error) {
      console.error('Failed to load counts:', error);
      toast.error('Fehler beim Laden der Aktivitäten');
    } finally {
      setLoading(false);
    }
  }, [settings.reservations_enabled]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  // Real-time subscriptions - refresh counts on any change
  useRealtimeSubscription<Rental>('rental', {
    onCreated: () => loadCounts(),
    onUpdated: () => loadCounts(),
    onDeleted: () => loadCounts(),
  });

  useRealtimeSubscription<Customer>('customer', {
    onCreated: () => loadCounts(),
    onUpdated: () => loadCounts(),
    onDeleted: () => loadCounts(),
  });

  useRealtimeSubscription<Reservation>('reservation', {
    onCreated: () => loadCounts(),
    onUpdated: () => loadCounts(),
    onDeleted: () => loadCounts(),
    enabled: settings.reservations_enabled,
  });

  if (loading) {
    return <p className="text-sm text-muted-foreground">Lädt...</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Checkouts */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Package className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-medium text-blue-700">Ausleihen</span>
        </div>
        <div className="text-2xl font-bold text-blue-900">{counts.checkouts}</div>
        <div className="text-xs text-blue-600 mt-1">Heute ausgegeben</div>
      </div>

      {/* Returns */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-xs font-medium text-green-700">Rückgaben</span>
        </div>
        <div className="text-2xl font-bold text-green-900">{counts.returns}</div>
        <div className="text-xs text-green-600 mt-1">Heute zurückgegeben</div>
      </div>

      {/* New Customers */}
      <div
        className={`${
          counts.newCustomers > 0
            ? 'bg-purple-50 border-purple-200'
            : 'bg-gray-50 border-gray-200'
        } border rounded-lg p-4`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Users
            className={`h-4 w-4 ${
              counts.newCustomers > 0 ? 'text-purple-600' : 'text-gray-600'
            }`}
          />
          <span
            className={`text-xs font-medium ${
              counts.newCustomers > 0 ? 'text-purple-700' : 'text-gray-700'
            }`}
          >
            Neue Nutzer:innen
          </span>
        </div>
        <div
          className={`text-2xl font-bold ${
            counts.newCustomers > 0 ? 'text-purple-900' : 'text-gray-900'
          }`}
        >
          {counts.newCustomers}
        </div>
        <div
          className={`text-xs mt-1 ${
            counts.newCustomers > 0 ? 'text-purple-600' : 'text-gray-600'
          }`}
        >
          Heute registriert
        </div>
      </div>

      {/* New Reservations - only show when enabled */}
      {settings.reservations_enabled && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-orange-600" />
            <span className="text-xs font-medium text-orange-700">
              Reservierungen
            </span>
          </div>
          <div className="text-2xl font-bold text-orange-900">
            {counts.newReservations}
          </div>
          <div className="text-xs text-orange-600 mt-1">Heute erstellt</div>
        </div>
      )}
    </div>
  );
}
