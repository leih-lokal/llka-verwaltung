/**
 * Overdue Rentals Alert Widget
 * Shows critical alert with breakdown of overdue rentals by severity
 */
'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { useUnreturnedRentals } from '@/hooks/use-unreturned-rentals';
import { calculateOverdueBreakdown } from '@/lib/utils/dashboard-metrics';
import { OVERDUE_LEVEL_DAYS } from '@/lib/utils/overdue';
import Link from 'next/link';

export function OverdueAlertSection() {
  const { rentals, loading } = useUnreturnedRentals();
  const breakdown = useMemo(() => calculateOverdueBreakdown(rentals), [rentals]);

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
        {/* Overdue (orange) */}
        <div className="bg-orange-50 border border-orange-200 rounded p-3 text-center">
          <div className="text-xl font-bold text-orange-700">
            {breakdown.overdue}
          </div>
          <div className="text-xs text-orange-600 mt-1">{OVERDUE_LEVEL_DAYS.overdue}</div>
        </div>

        {/* Critical (red) */}
        <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
          <div className="text-xl font-bold text-red-700">
            {breakdown.critical}
          </div>
          <div className="text-xs text-red-600 mt-1">{OVERDUE_LEVEL_DAYS.critical}</div>
        </div>

        {/* Severely critical (dark red) */}
        <div className="bg-red-100 border border-red-400 rounded p-3 text-center">
          <div className="text-xl font-bold text-red-800">
            {breakdown.severely_critical}
          </div>
          <div className="text-xs text-red-700 mt-1">{OVERDUE_LEVEL_DAYS.severely_critical}</div>
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
