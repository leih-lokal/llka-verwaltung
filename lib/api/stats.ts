/**
 * Stats API Service
 * Fetches aggregated statistics from PocketBase with localStorage caching
 */

import { pb, getServerUrl } from '@/lib/pocketbase/client';

interface MonthlyStats {
  [month: string]: number;
}

export interface StatsResponse {
  new_customers_count: MonthlyStats;
  active_customers_count: MonthlyStats;
  rentals_count: MonthlyStats;
  total_items: MonthlyStats;
}

interface CachedStats {
  data: StatsResponse;
  timestamp: number;
}

const CACHE_KEY = 'dashboard_stats_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Cache key per PocketBase server, so switching servers doesn't show the
 * other instance's stats until the cache expires
 */
function getCacheKey(): string {
  return `${CACHE_KEY}:${getServerUrl()}`;
}

/**
 * Gets the latest value from a monthly stats object
 */
function getLatestValue(monthlyStats: MonthlyStats): number {
  const months = Object.keys(monthlyStats).sort();
  if (months.length === 0) return 0;

  const latestMonth = months[months.length - 1];
  return monthlyStats[latestMonth] || 0;
}

/**
 * Fetches stats from cache if valid, otherwise from API
 */
export async function fetchStats(): Promise<StatsResponse> {
  // Resolve the key up front: the response must be cached under the server
  // it came from, even if the URL changes while the request is in flight
  const cacheKey = getCacheKey();

  // Check cache first
  const cached = getCachedStats(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from API using PocketBase client (handles auth automatically)
  const data: StatsResponse = await pb.send('/api/stats', {
    method: 'GET',
  });

  // Cache the response
  setCachedStats(cacheKey, data);

  return data;
}

/**
 * Gets cached stats if still valid
 */
function getCachedStats(cacheKey: string): StatsResponse | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const { data, timestamp }: CachedStats = JSON.parse(cached);
    const age = Date.now() - timestamp;

    // Return cached data if less than 1 hour old
    if (age < CACHE_TTL) {
      return data;
    }

    // Cache expired, remove it
    localStorage.removeItem(cacheKey);
    return null;
  } catch (error) {
    console.error('Error reading stats cache:', error);
    localStorage.removeItem(cacheKey);
    return null;
  }
}

/**
 * Saves stats to localStorage cache
 */
function setCachedStats(cacheKey: string, data: StatsResponse): void {
  if (typeof window === 'undefined') return;

  try {
    const cached: CachedStats = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(cached));
  } catch (error) {
    console.error('Error caching stats:', error);
  }
}

/**
 * Extracts the current total items count from stats response
 */
export function getTotalItemsFromStats(stats: StatsResponse): number {
  return getLatestValue(stats.total_items);
}

/**
 * Clears the stats cache (useful for manual refresh)
 */
export function clearStatsCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getCacheKey());
}
