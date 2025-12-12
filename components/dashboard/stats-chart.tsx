/**
 * Dashboard stats chart component
 * Displays historical trends for customers, rentals, and items
 */
'use client';

import { useMemo } from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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

interface StatsChartProps {
  stats: StatsResponse | null;
  loading?: boolean;
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

export function StatsChart({ stats, loading }: StatsChartProps) {
  const chartData = useMemo(() => {
    if (!stats) return [];
    return transformStatsForChart(stats);
  }, [stats]);

  if (loading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  if (!stats || chartData.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <p className="text-muted-foreground">Keine Statistikdaten gefunden</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Entwicklung über die letzten 2 Jahre
      </p>
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
    </div>
  );
}
