/**
 * Item Analytics Dashboard
 * Provides comprehensive performance metrics and insights for inventory management
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCwIcon, TrendingUpIcon, PackageIcon, BarChart3Icon } from 'lucide-react';
import { collections } from '@/lib/pocketbase/client';
import {
  calculateItemAnalytics,
  calculateAggregateAnalytics,
  type ItemAnalytics,
  type AggregateAnalytics,
} from '@/lib/utils/item-stats';
import type { Item, Rental } from '@/types';
import { toast } from 'sonner';
import { AnalyticsOverview } from '@/components/item-analytics/analytics-overview';
import { TopPerformersTable } from '@/components/item-analytics/top-performers-table';
import { UnderutilizedTable } from '@/components/item-analytics/underutilized-table';
import { CategoryPerformance } from '@/components/item-analytics/category-performance';

export default function ItemAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [itemsAnalytics, setItemsAnalytics] = useState<ItemAnalytics[]>([]);
  const [aggregateAnalytics, setAggregateAnalytics] = useState<AggregateAnalytics | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      setLoading(true);

      // Fetch all items (excluding soft-deleted) and all rentals in parallel
      const [items, rentals] = await Promise.all([
        collections.items().getFullList<Item>({
          filter: 'status != "deleted"',
          fields: 'id,iid,name,category,status,added_on,copies',
        }),
        collections.rentals().getFullList<Rental>({
          fields: 'id,items,rented_on,returned_on',
        }),
      ]);

      // Calculate analytics
      const analytics = calculateItemAnalytics(items, rentals);
      const aggregate = calculateAggregateAnalytics(analytics);

      setItemsAnalytics(analytics);
      setAggregateAnalytics(aggregate);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Fehler beim Laden der Analytik');
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    loadAnalytics();
    toast.success('Daten aktualisiert');
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gegenstands-Analytik</h1>
          <p className="text-muted-foreground mt-1">
            Leistungsmetriken und Erkenntnisse für Bestandsverwaltung
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Zuletzt aktualisiert: {lastRefresh.toLocaleTimeString('de-DE')}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCwIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && !aggregateAnalytics ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-sm text-muted-foreground">Analytik wird geladen...</p>
          </div>
        </div>
      ) : aggregateAnalytics ? (
        <div className="space-y-8">
          {/* Overview Metrics */}
          <AnalyticsOverview analytics={aggregateAnalytics} />

          {/* Top Performers */}
          <TopPerformersTable items={itemsAnalytics} />

          {/* Underutilized Items */}
          <UnderutilizedTable items={itemsAnalytics} />

          {/* Category Performance */}
          <CategoryPerformance
            analytics={aggregateAnalytics}
            items={itemsAnalytics}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <PackageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Keine Daten verfügbar</p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-4">
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
