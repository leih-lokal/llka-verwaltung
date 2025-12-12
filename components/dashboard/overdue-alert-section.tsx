/**
 * Overdue Rentals Alert Widget
 * Shows critical alert with breakdown of overdue rentals by severity
 */
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { collections } from '@/lib/pocketbase/client';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import type { Rental, RentalExpanded, OverdueBreakdown } from '@/types';
import { calculateOverdueBreakdown } from '@/lib/utils/dashboard-metrics';
import { toast } from 'sonner';
import Link from 'next/link';

export function OverdueAlertSection() {
  const [rentals, setRentals] = useState<RentalExpanded[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] = useState<OverdueBreakdown>({
    severity1to3Days: 0,
    severity4to7Days: 0,
    severity8PlusDays: 0,
    total: 0,
  });

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

  // Recalculate breakdown whenever rentals change
  useEffect(() => {
    setBreakdown(calculateOverdueBreakdown(rentals));
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

  if (loading) {
    return <p className="text-sm text-muted-foreground">Lädt...</p>;
  }

  // No overdue rentals - show success state
  if (breakdown.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
          <svg
            className="w-6 h-6 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-green-700">
          Keine überfälligen Ausleihen
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Alle Ausleihen sind im Zeitplan
        </p>
      </div>
    );
  }

  // Overdue rentals exist - show alert
  return (
    <div className="space-y-4">
      {/* Total count with red alert styling */}
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-8 w-8 text-red-600" />
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-red-700">
              {breakdown.total}
            </h3>
            <p className="text-sm text-red-600">
              {breakdown.total === 1
                ? 'Überfällige Ausleihe'
                : 'Überfällige Ausleihen'}
            </p>
          </div>
        </div>
      </div>

      {/* Severity breakdown grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* 1-3 days (orange) */}
        <div className="bg-orange-50 border border-orange-200 rounded p-3 text-center">
          <div className="text-xl font-bold text-orange-700">
            {breakdown.severity1to3Days}
          </div>
          <div className="text-xs text-orange-600 mt-1">1-3 Tage</div>
        </div>

        {/* 4-7 days (red) */}
        <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
          <div className="text-xl font-bold text-red-700">
            {breakdown.severity4to7Days}
          </div>
          <div className="text-xs text-red-600 mt-1">4-7 Tage</div>
        </div>

        {/* 8+ days (dark red) */}
        <div className="bg-red-100 border border-red-400 rounded p-3 text-center">
          <div className="text-xl font-bold text-red-800">
            {breakdown.severity8PlusDays}
          </div>
          <div className="text-xs text-red-700 mt-1">8+ Tage</div>
        </div>
      </div>

      {/* Details button */}
      <Button asChild variant="outline" className="w-full" size="sm">
        <Link href="/overdue">
          <ExternalLink className="h-4 w-4 mr-2" />
          Details anzeigen
        </Link>
      </Button>
    </div>
  );
}
