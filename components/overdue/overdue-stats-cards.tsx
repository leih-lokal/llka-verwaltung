/**
 * Overdue Stats Cards
 * Displays operational metrics for overdue management
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircleIcon, ClockIcon, TrendingDownIcon, PercentIcon } from 'lucide-react';
import type { RentalExpanded, Rental } from '@/types';
import { useEffect, useMemo, useState } from 'react';
import { collections } from '@/lib/pocketbase/client';
import { differenceInDays, parseISO, subDays } from 'date-fns';
import { dateToLocalString } from '@/lib/utils/formatting';
import type { OverdueSeverity } from '@/lib/utils/overdue';

interface OverdueStatsCardsProps {
  categorizedRentals: Record<OverdueSeverity, RentalExpanded[]>;
}

export function OverdueStatsCards({ categorizedRentals }: OverdueStatsCardsProps) {
  const [onTimeRate, setOnTimeRate] = useState<number | null>(null);

  const totalOverdue = categorizedRentals.severely_critical.length +
                       categorizedRentals.critical.length +
                       categorizedRentals.overdue.length;

  // Refreshed whenever the overdue lists change
  useEffect(() => {
    let cancelled = false;

    async function loadOnTimeRate() {
      try {
        // Get rentals returned in last 30 days
        // returned_on is date-only; compare as a local date string ("YYYY-MM-DD")
        const thirtyDaysAgo = dateToLocalString(subDays(new Date(), 30));
        const rentals = await collections.rentals().getFullList<Rental>({
          filter: `returned_on >= "${thirtyDaysAgo}"`,
          fields: 'returned_on,expected_on',
        });
        if (cancelled) return;

        if (rentals.length === 0) {
          setOnTimeRate(null);
          return;
        }

        // Count how many were returned on time
        const onTime = rentals.filter(r => {
          if (!r.returned_on || !r.expected_on) return false;
          return parseISO(r.returned_on) <= parseISO(r.expected_on);
        }).length;

        setOnTimeRate((onTime / rentals.length) * 100);
      } catch (err) {
        if (cancelled) return;
        console.error('Error calculating on-time rate:', err);
        setOnTimeRate(null);
      }
    }

    loadOnTimeRate();
    return () => {
      cancelled = true;
    };
  }, [categorizedRentals]);

  const avgDaysOverdue = useMemo(() => {
    const allOverdue = [
      ...categorizedRentals.severely_critical,
      ...categorizedRentals.critical,
      ...categorizedRentals.overdue,
    ];

    if (allOverdue.length === 0) {
      return 0;
    }

    const now = new Date();
    const totalDays = allOverdue.reduce((sum, rental) => {
      const days = differenceInDays(now, parseISO(rental.expected_on));
      return sum + Math.max(0, days);
    }, 0);

    return Math.round(totalDays / allOverdue.length);
  }, [categorizedRentals]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Overdue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gesamt Überfällig</CardTitle>
          <AlertCircleIcon className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{totalOverdue}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {categorizedRentals.severely_critical.length > 0 && (
              <span className="text-red-600 font-semibold">
                {categorizedRentals.severely_critical.length} extrem überfällig
              </span>
            )}
            {categorizedRentals.severely_critical.length === 0 && totalOverdue > 0 && (
              <span>Keine extremen Fälle</span>
            )}
            {totalOverdue === 0 && <span className="text-green-600">Alles gut!</span>}
          </p>
        </CardContent>
      </Card>

      {/* On-Time Return Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pünktliche Rückgabe</CardTitle>
          <PercentIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {onTimeRate !== null ? `${onTimeRate.toFixed(0)}%` : '—'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Letzte 30 Tage
          </p>
        </CardContent>
      </Card>

      {/* Average Days Overdue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ø Tage überfällig</CardTitle>
          <ClockIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {totalOverdue > 0 ? avgDaysOverdue : '0'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Durchschnitt
          </p>
        </CardContent>
      </Card>

      {/* Due Today & Soon */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Heute & Bald fällig</CardTitle>
          <TrendingDownIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {categorizedRentals.due_today.length + categorizedRentals.due_soon.length}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {categorizedRentals.due_today.length} heute, {categorizedRentals.due_soon.length} bald
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
