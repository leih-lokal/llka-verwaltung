/**
 * Dashboard stats chart component
 * Displays historical trends for customers, rentals, and items
 */
'use client';

import { useMemo } from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { StatsResponse } from '@/lib/api/stats';
import { transformStatsForChart } from '@/lib/utils/stats';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface StatsChartProps {
  stats: StatsResponse | null;
  loading?: boolean;
  onRefresh?: () => void;
}

// Chart configuration with colors matching old Svelte version
const chartConfig = {
  activeCustomers: {
    label: 'Aktive Nutzer:innen',
    color: '#f20c0d', // Dark purple
  },
  rentals: {
    label: 'Anzahl Ausleihen',
    color: '#3b0617', // Pink
  },
  newCustomers: {
    label: 'Neue Nutzer:innen',
    color: '#f9b4be', // Green
  },
  totalItems: {
    label: 'Anzahl Gegenstände',
    color: '#620c24', // Light blue
  },
} satisfies ChartConfig;

export function StatsChart({ stats, loading, onRefresh }: StatsChartProps) {
  const chartData = useMemo(() => {
    if (!stats) return [];
    return transformStatsForChart(stats);
  }, [stats]);

  if (loading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats || chartData.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Statistiken</CardTitle>
          <CardDescription>
            Keine Daten verfügbar
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center text-muted-foreground">
          <p>Keine Statistikdaten gefunden</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle>Statistiken</CardTitle>
          <CardDescription>
            Entwicklung über die letzten 2 Jahre
          </CardDescription>
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-8 w-8"
            title="Statistiken aktualisieren"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: 10,
              left: 10,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
            />
            <ChartLegend content={<ChartLegendContent />} />

            {/* Active Customers - Purple */}
            <Line
              type="monotone"
              dataKey="activeCustomers"
              stroke={chartConfig.activeCustomers.color}
              strokeWidth={2}
              fill={chartConfig.activeCustomers.color}
              fillOpacity={0.3}
              dot={{
                fill: '#fff',
                stroke: chartConfig.activeCustomers.color,
                strokeWidth: 2,
                r: 3,
              }}
              activeDot={{ r: 5 }}
            />

            {/* Rentals - Pink */}
            <Line
              type="monotone"
              dataKey="rentals"
              stroke={chartConfig.rentals.color}
              strokeWidth={2}
              fill={chartConfig.rentals.color}
              fillOpacity={0.3}
              dot={{
                fill: '#fff',
                stroke: chartConfig.rentals.color,
                strokeWidth: 2,
                r: 3,
              }}
              activeDot={{ r: 5 }}
            />

            {/* New Customers - Green */}
            <Line
              type="monotone"
              dataKey="newCustomers"
              stroke={chartConfig.newCustomers.color}
              strokeWidth={2}
              fill={chartConfig.newCustomers.color}
              fillOpacity={0.3}
              dot={{
                fill: '#fff',
                stroke: chartConfig.newCustomers.color,
                strokeWidth: 2,
                r: 3,
              }}
              activeDot={{ r: 5 }}
            />

            {/* Total Items - Blue */}
            <Line
              type="monotone"
              dataKey="totalItems"
              stroke={chartConfig.totalItems.color}
              strokeWidth={2}
              fill={chartConfig.totalItems.color}
              fillOpacity={0.3}
              dot={{
                fill: '#fff',
                stroke: chartConfig.totalItems.color,
                strokeWidth: 2,
                r: 3,
              }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
