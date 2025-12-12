/**
 * Today's Activity Widget
 * Shows daily activity summary: checkouts, returns, new customers, reservations
 */
'use client';

import { useEffect, useState } from 'react';
import { Package, CheckCircle, Users, Calendar } from 'lucide-react';
import { collections } from '@/lib/pocketbase/client';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import type {
  Rental,
  RentalExpanded,
  Customer,
  Reservation,
  TodayActivityMetrics,
} from '@/types';
import { calculateTodayMetrics } from '@/lib/utils/dashboard-metrics';
import { toast } from 'sonner';

export function TodayActivitySection() {
  const [rentals, setRentals] = useState<RentalExpanded[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<TodayActivityMetrics>({
    checkouts: 0,
    returns: 0,
    onTimeReturns: 0,
    lateReturns: 0,
    newCustomers: 0,
    newReservations: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  // Real-time subscriptions
  useRealtimeSubscription<Rental>('rental', {
    onCreated: async (rental) => {
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
    },
    onUpdated: async (rental) => {
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
    },
    onDeleted: (rental) => {
      setRentals((prev) => prev.filter((r) => r.id !== rental.id));
    },
  });

  useRealtimeSubscription<Customer>('customer', {
    onCreated: (customer) => {
      setCustomers((prev) => {
        if (prev.some((c) => c.id === customer.id)) return prev;
        return [...prev, customer];
      });
    },
    onUpdated: (customer) => {
      setCustomers((prev) =>
        prev.map((c) => (c.id === customer.id ? customer : c))
      );
    },
    onDeleted: (customer) => {
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
    },
  });

  useRealtimeSubscription<Reservation>('reservation', {
    onCreated: (reservation) => {
      setReservations((prev) => {
        if (prev.some((r) => r.id === reservation.id)) return prev;
        return [...prev, reservation];
      });
    },
    onUpdated: (reservation) => {
      setReservations((prev) =>
        prev.map((r) => (r.id === reservation.id ? reservation : r))
      );
    },
    onDeleted: (reservation) => {
      setReservations((prev) => prev.filter((r) => r.id !== reservation.id));
    },
  });

  // Recalculate metrics whenever data changes
  useEffect(() => {
    setMetrics(calculateTodayMetrics(rentals, customers, reservations));
  }, [rentals, customers, reservations]);

  async function loadData() {
    try {
      setLoading(true);

      // Load all data in parallel
      const [rentalsResult, customersResult, reservationsResult] =
        await Promise.all([
          collections.rentals().getFullList<RentalExpanded>({
            expand: 'customer,items',
          }),
          collections.customers().getFullList<Customer>(),
          collections.reservations().getFullList<Reservation>(),
        ]);

      setRentals(rentalsResult);
      setCustomers(customersResult);
      setReservations(reservationsResult);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  }

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
        <div className="text-2xl font-bold text-blue-900">
          {metrics.checkouts}
        </div>
        <div className="text-xs text-blue-600 mt-1">Heute ausgegeben</div>
      </div>

      {/* Returns */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-xs font-medium text-green-700">Rückgaben</span>
        </div>
        <div className="text-2xl font-bold text-green-900">
          {metrics.returns}
        </div>
        <div className="text-xs text-green-600 mt-1">
          {metrics.onTimeReturns > 0 && (
            <span className="font-medium">
              {metrics.onTimeReturns} pünktlich
            </span>
          )}
          {metrics.onTimeReturns > 0 && metrics.lateReturns > 0 && (
            <span>, </span>
          )}
          {metrics.lateReturns > 0 && (
            <span className="text-orange-600">
              {metrics.lateReturns} verspätet
            </span>
          )}
          {metrics.returns === 0 && <span>Heute zurückgegeben</span>}
        </div>
      </div>

      {/* New Customers */}
      <div
        className={`${
          metrics.newCustomers > 0
            ? 'bg-purple-50 border-purple-200'
            : 'bg-gray-50 border-gray-200'
        } border rounded-lg p-4`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Users
            className={`h-4 w-4 ${
              metrics.newCustomers > 0 ? 'text-purple-600' : 'text-gray-600'
            }`}
          />
          <span
            className={`text-xs font-medium ${
              metrics.newCustomers > 0 ? 'text-purple-700' : 'text-gray-700'
            }`}
          >
            Neue Nutzer:innen
          </span>
        </div>
        <div
          className={`text-2xl font-bold ${
            metrics.newCustomers > 0 ? 'text-purple-900' : 'text-gray-900'
          }`}
        >
          {metrics.newCustomers}
        </div>
        <div
          className={`text-xs mt-1 ${
            metrics.newCustomers > 0 ? 'text-purple-600' : 'text-gray-600'
          }`}
        >
          Heute registriert
        </div>
      </div>

      {/* New Reservations */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-orange-600" />
          <span className="text-xs font-medium text-orange-700">
            Reservierungen
          </span>
        </div>
        <div className="text-2xl font-bold text-orange-900">
          {metrics.newReservations}
        </div>
        <div className="text-xs text-orange-600 mt-1">Heute erstellt</div>
      </div>
    </div>
  );
}
