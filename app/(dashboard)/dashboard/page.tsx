/**
 * Dashboard home page with stats, notes, active rentals, and reservations
 */
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Package,
  TrendingUp,
  AlertCircle,
  Plus,
  Calendar,
  ClipboardList,
  StickyNote,
  Clock,
} from 'lucide-react';
import { collections } from '@/lib/pocketbase/client';
import { calculateRentalStatus, formatDate, formatFullName } from '@/lib/utils/formatting';
import type { RentalExpanded, ReservationExpanded, Note } from '@/types';
import { RentalStatus } from '@/types';
import { DashboardNotes } from '@/components/dashboard/dashboard-notes';
import { ActiveRentalsSection } from '@/components/dashboard/active-rentals-section';
import { TodaysReservationsSection } from '@/components/dashboard/todays-reservations-section';
import Link from 'next/link';
import { toast } from 'sonner';

interface DashboardStats {
  totalCustomers: number;
  totalItems: number;
  activeRentals: number;
  dueTodayRentals: number;
  overdueRentals: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalItems: 0,
    activeRentals: 0,
    dueTodayRentals: 0,
    overdueRentals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);

      // Fetch stats in parallel
      const [customersResult, itemsResult, rentalsResult] = await Promise.all([
        collections.customers().getList(1, 1),
        collections.items().getList(1, 1, {
          filter: 'status != "deleted"',
        }),
        collections.rentals().getFullList<RentalExpanded>({
          expand: 'customer,items',
          sort: '-rented_on',
        }),
      ]);

      // Calculate rental stats
      const activeRentals = rentalsResult.filter((r) => !r.returned_on);
      const dueTodayRentals = activeRentals.filter((r) => {
        const status = calculateRentalStatus(
          r.rented_on,
          r.returned_on,
          r.expected_on,
          r.extended_on
        );
        return status === RentalStatus.DueToday;
      });
      const overdueRentals = activeRentals.filter((r) => {
        const status = calculateRentalStatus(
          r.rented_on,
          r.returned_on,
          r.expected_on,
          r.extended_on
        );
        return status === RentalStatus.Overdue;
      });

      setStats({
        totalCustomers: customersResult.totalItems,
        totalItems: itemsResult.totalItems,
        activeRentals: activeRentals.length,
        dueTodayRentals: dueTodayRentals.length,
        overdueRentals: overdueRentals.length,
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      toast.error('Fehler beim Laden der Statistiken');
    } finally {
      setLoading(false);
    }
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
      </div>

      {/* 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Rentals & Reservations */}
        <div className="space-y-6">
          <ActiveRentalsSection onRentalReturned={loadStats} />
          <TodaysReservationsSection onReservationCompleted={loadStats} />
        </div>

        {/* Right Column: Stats & Notes */}
        <div className="space-y-6">
          {/* Stats (2x2 grid) */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2 px-3">
                <CardTitle className="text-xs font-medium">Nutzer:innen</CardTitle>
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent className="px-3 pb-2 flex-1 flex flex-col justify-center">
                <div className="text-xl font-bold text-blue-700 dark:text-blue-300 leading-none">
                  {loading ? '...' : stats.totalCustomers}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Gesamt registriert</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2 px-3">
                <CardTitle className="text-xs font-medium">Gegenstände</CardTitle>
                <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </CardHeader>
              <CardContent className="px-3 pb-2 flex-1 flex flex-col justify-center">
                <div className="text-xl font-bold text-purple-700 dark:text-purple-300 leading-none">
                  {loading ? '...' : stats.totalItems}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Im Inventar</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950/20 dark:to-background flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2 px-3">
                <CardTitle className="text-xs font-medium">Heute fällig</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </CardHeader>
              <CardContent className="px-3 pb-2 flex-1 flex flex-col justify-center">
                <div className="text-xl font-bold text-yellow-700 dark:text-yellow-300 leading-none">
                  {loading ? '...' : stats.dueTodayRentals}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Rückgabe heute</p>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2 px-3">
                <CardTitle className="text-xs font-medium">Überfällig</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </CardHeader>
              <CardContent className="px-3 pb-2 flex-1 flex flex-col justify-center">
                <div className="text-xl font-bold text-red-700 dark:text-red-300 leading-none">
                  {loading ? '...' : stats.overdueRentals}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Rückgabe überfällig</p>
              </CardContent>
            </Card>
          </div>

          <DashboardNotes />
        </div>
      </div>
    </div>
  );
}
