/**
 * Dashboard home page with stats, notes, active rentals, and reservations
 */
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Calendar,
  Users,
  Package,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import { fetchStats, clearStatsCache, type StatsResponse } from '@/lib/api/stats';
import { DashboardNotes } from '@/components/dashboard/dashboard-notes';
import { ActiveRentalsSection } from '@/components/dashboard/active-rentals-section';
import { TodaysReservationsSection } from '@/components/dashboard/todays-reservations-section';
import { StatsChart } from '@/components/dashboard/stats-chart';
import Link from 'next/link';
import { toast } from 'sonner';

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      const statsData = await fetchStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      toast.error('Fehler beim Laden der Statistiken');
    } finally {
      setLoading(false);
    }
  }

  function handleRefreshStats() {
    clearStatsCache();
    loadStats();
    toast.success('Statistiken werden aktualisiert...');
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg" className="shadow-md hover:shadow-lg transition-shadow">
          <Link href="/rentals?action=new">
            <Plus className="mr-2 h-4 w-4" />
            Neue Ausleihe
          </Link>
        </Button>
        <Button variant="outline" asChild size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <Link href="/reservations?action=new">
            <Calendar className="mr-2 h-4 w-4" />
            Neue Reservierung
          </Link>
        </Button>
        <Button variant="outline" asChild size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <Link href="/customers?action=new">
            <Users className="mr-2 h-4 w-4" />
            Neue:r Nutzer:in
          </Link>
        </Button>
        <Button variant="outline" asChild size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <Link href="/items?action=new">
            <Package className="mr-2 h-4 w-4" />
            Neuer Gegenstand
          </Link>
        </Button>

        {/* Divider */}
        <div className="w-px bg-border self-stretch mx-1" />

        {/* New Quick Access Buttons */}
        <Button variant="outline" asChild size="lg" className="flex-2 shadow-sm transition-shadow border-red-200 hover:border-red-300 hover:bg-red-500">
          <Link href="/overdue">
            <AlertCircle className="mr-2 h-4 w-4  hover:text-white text-red-500"/>
            Überfälliges
          </Link>
        </Button>
        <Button variant="outline" asChild size="lg" className="flex-2 shadow-sm transition-shadow border-red-200 hover:border-red-300 hover:bg-red-500">
          <Link href="/items/analytics">
            <BarChart3 className="mr-2 h-4 w-4  hover:text-white text-red-500" />
            Inventaranalyse
          </Link>
        </Button>
      </div>

      {/* 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Rentals & Reservations */}
        <div className="space-y-6">
          <TodaysReservationsSection onReservationCompleted={loadStats} />
          <ActiveRentalsSection onRentalReturned={loadStats} />
        </div>

        {/* Right Column: Notes & Stats */}
        <div className="space-y-6">
          <DashboardNotes />
          <StatsChart stats={stats} loading={loading} onRefresh={handleRefreshStats} />
        </div>
      </div>
    </div>
  );
}
