/**
 * Stats data transformation utilities
 * Transforms PocketBase stats API response to chart-friendly format
 */

import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { StatsResponse } from '@/lib/api/stats';

export interface ChartDataPoint {
  month: string; // Formatted month label (e.g., "Jan 2024")
  monthKey: string; // Original month key (e.g., "2024-01")
  activeCustomers: number;
  rentals: number;
  newCustomers: number;
  totalItems: number;
}

/**
 * Formats a month key (YYYY-MM) to a readable label
 */
function formatMonthLabel(monthKey: string): string {
  try {
    // Parse YYYY-MM format by adding day
    const date = parseISO(`${monthKey}-01`);
    // Format as "Jan 2024" in German locale
    return format(date, 'MMM yyyy', { locale: de });
  } catch {
    return monthKey;
  }
}

/**
 * Transforms stats API response to Recharts-compatible format
 * Filters to only show the last 2 years of data
 */
export function transformStatsForChart(stats: StatsResponse): ChartDataPoint[] {
  // Calculate cutoff date (2 years ago)
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);
  const cutoffKey = format(twoYearsAgo, 'yyyy-MM');

  // Get all unique month keys from all series
  const allMonths = new Set<string>();

  Object.keys(stats.new_customers_count).forEach((m) => allMonths.add(m));
  Object.keys(stats.active_customers_count).forEach((m) => allMonths.add(m));
  Object.keys(stats.rentals_count).forEach((m) => allMonths.add(m));
  Object.keys(stats.total_items).forEach((m) => allMonths.add(m));

  // Sort months chronologically and filter to last 2 years
  const sortedMonths = Array.from(allMonths)
    .sort()
    .filter((monthKey) => monthKey >= cutoffKey);

  // Transform to chart data points
  return sortedMonths.map((monthKey) => ({
    month: formatMonthLabel(monthKey),
    monthKey,
    activeCustomers: stats.active_customers_count[monthKey] || 0,
    rentals: stats.rentals_count[monthKey] || 0,
    newCustomers: stats.new_customers_count[monthKey] || 0,
    totalItems: stats.total_items[monthKey] || 0,
  }));
}

/**
 * Gets the latest values from stats for display
 */
export function getLatestStatsValues(stats: StatsResponse) {
  const chartData = transformStatsForChart(stats);

  if (chartData.length === 0) {
    return {
      activeCustomers: 0,
      rentals: 0,
      newCustomers: 0,
      totalItems: 0,
    };
  }

  const latest = chartData[chartData.length - 1];
  return {
    activeCustomers: latest.activeCustomers,
    rentals: latest.rentals,
    newCustomers: latest.newCustomers,
    totalItems: latest.totalItems,
  };
}
