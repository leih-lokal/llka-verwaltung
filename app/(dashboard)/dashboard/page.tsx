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
  Printer,
  RefreshCw,
  ClipboardList,
  StickyNote,
} from 'lucide-react';
import { fetchStats, clearStatsCache, type StatsResponse } from '@/lib/api/stats';
import { DashboardNotes } from '@/components/dashboard/dashboard-notes';
import { ActiveRentalsSection } from '@/components/dashboard/active-rentals-section';
import { TodaysReservationsSection } from '@/components/dashboard/todays-reservations-section';
import { StatsChart } from '@/components/dashboard/stats-chart';
import { OverdueAlertSection } from '@/components/dashboard/overdue-alert-section';
import { DueThisWeekSection } from '@/components/dashboard/due-this-week-section';
import { TodayActivitySection } from '@/components/dashboard/today-activity-section';
import { useDashboardPreferences } from '@/hooks/use-dashboard-preferences';
import { DashboardViewMenu } from '@/components/dashboard/dashboard-view-menu';
import { CollapsibleSection } from '@/components/dashboard/collapsible-section';
import { generateReservationPrintContent } from '@/components/print/reservation-print-content';
import type { ReservationExpanded } from '@/types';
import { collections } from '@/lib/pocketbase/client';
import { startOfDay, endOfDay } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/use-settings';

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<ReservationExpanded[]>([]);
  const [addNoteHandler, setAddNoteHandler] = useState<(() => void) | null>(null);

  // Settings hook for feature toggles
  const { settings } = useSettings();

  // Dashboard preferences hook
  const {
    componentVisibility,
    toggleVisibility,
    componentCollapsed,
    toggleCollapse,
  } = useDashboardPreferences();

  useEffect(() => {
    loadStats();
    if (settings.reservations_enabled) {
      loadReservations();
    }
  }, [settings.reservations_enabled]);

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

  async function loadReservations() {
    try {
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      const result = await collections
        .reservations()
        .getFullList<ReservationExpanded>({
          expand: 'items',
          filter: `done = false && pickup >= "${startOfToday.toISOString()}" && pickup <= "${endOfToday.toISOString()}"`,
          sort: 'pickup',
        });

      setReservations(result);
    } catch (error) {
      console.error('Failed to load reservations:', error);
    }
  }

  function handleRefreshStats() {
    clearStatsCache();
    loadStats();
    toast.success('Statistiken werden aktualisiert...');
  }

  function handlePrintReservations() {
    const htmlContent = generateReservationPrintContent(reservations);
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Dashboard Header with View Menu */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <DashboardViewMenu
          visibility={componentVisibility}
          onToggleVisibility={toggleVisibility}
        />
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg" className="shadow-md hover:shadow-lg transition-shadow">
          <Link href="/rentals?action=new">
            <Plus className="mr-2 h-4 w-4" />
            Neue Ausleihe
          </Link>
        </Button>
        {settings.reservations_enabled && (
          <Button variant="outline" asChild size="lg" className="shadow-sm hover:shadow-md transition-shadow">
            <Link href="/reservations?action=new">
              <Calendar className="mr-2 h-4 w-4" />
              Neue Reservierung
            </Link>
          </Button>
        )}
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

      {/* 3 Column Layout - New Activity Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {componentVisibility['overdue-alert'] && (
          <CollapsibleSection
            title="Überfällige Ausleihen"
            titleIcon={<AlertCircle className="h-5 w-5 text-red-600" />}
            isCollapsed={componentCollapsed['overdue-alert']}
            onToggleCollapse={() => toggleCollapse('overdue-alert')}
            className="border-red-200"
          >
            <OverdueAlertSection />
          </CollapsibleSection>
        )}

        {componentVisibility['due-this-week'] && (
          <CollapsibleSection
            title="Fällig diese Woche"
            titleIcon={<Calendar className="h-5 w-5 text-blue-600" />}
            isCollapsed={componentCollapsed['due-this-week']}
            onToggleCollapse={() => toggleCollapse('due-this-week')}
          >
            <DueThisWeekSection />
          </CollapsibleSection>
        )}

        {componentVisibility['today-activity'] && (
          <CollapsibleSection
            title="Heutige Aktivität"
            titleIcon={<BarChart3 className="h-5 w-5" />}
            isCollapsed={componentCollapsed['today-activity']}
            onToggleCollapse={() => toggleCollapse('today-activity')}
          >
            <TodayActivitySection />
          </CollapsibleSection>
        )}
      </div>

      {/* 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Rentals & Reservations */}
        <div className="space-y-6">
          {settings.reservations_enabled && componentVisibility['todays-reservations'] && (
            <CollapsibleSection
              title="Heutige Reservierungen"
              titleIcon={<Calendar className="h-5 w-5" />}
              headerActions={
                reservations.length > 0 && (
                  <Button size="sm" variant="outline" onClick={handlePrintReservations}>
                    <Printer className="h-4 w-4 mr-2" />
                    Drucken
                  </Button>
                )
              }
              isCollapsed={componentCollapsed['todays-reservations']}
              onToggleCollapse={() => toggleCollapse('todays-reservations')}
            >
              <TodaysReservationsSection onReservationCompleted={() => { loadStats(); loadReservations(); }} />
            </CollapsibleSection>
          )}

          {componentVisibility['active-rentals'] && (
            <CollapsibleSection
              title="Aktive Ausleihen"
              titleIcon={<ClipboardList className="h-5 w-5" />}
              isCollapsed={componentCollapsed['active-rentals']}
              onToggleCollapse={() => toggleCollapse('active-rentals')}
            >
              <ActiveRentalsSection onRentalReturned={loadStats} />
            </CollapsibleSection>
          )}
        </div>

        {/* Right Column: Notes & Stats */}
        <div className="space-y-6">
          {componentVisibility['dashboard-notes'] && (
            <CollapsibleSection
              title="Notizen"
              titleIcon={<StickyNote className="h-5 w-5" />}
              headerActions={
                addNoteHandler && (
                  <Button size="sm" onClick={addNoteHandler}>
                    <Plus className="mr-1 h-4 w-4" />
                    Neu
                  </Button>
                )
              }
              isCollapsed={componentCollapsed['dashboard-notes']}
              onToggleCollapse={() => toggleCollapse('dashboard-notes')}
            >
              <DashboardNotes onRequestAddNote={setAddNoteHandler} />
            </CollapsibleSection>
          )}

          {componentVisibility['stats-chart'] && (
            <CollapsibleSection
              title="Statistiken"
              titleIcon={<BarChart3 className="h-5 w-5" />}
              headerActions={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefreshStats}
                  className="h-8 w-8"
                  title="Statistiken aktualisieren"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              }
              isCollapsed={componentCollapsed['stats-chart']}
              onToggleCollapse={() => toggleCollapse('stats-chart')}
            >
              <StatsChart stats={stats} loading={loading} />
            </CollapsibleSection>
          )}
        </div>
      </div>
    </div>
  );
}
