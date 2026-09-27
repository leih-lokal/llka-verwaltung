/**
 * Category Performance
 * Charts showing rental distribution and performance by category
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3Icon, PieChartIcon } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AggregateAnalytics } from '@/lib/utils/item-stats';
import { getCategoryLabel } from '@/lib/constants/categories';

interface CategoryPerformanceProps {
  analytics: AggregateAnalytics;
}

// Colors for chart segments
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export function CategoryPerformance({ analytics }: CategoryPerformanceProps) {
  // Prepare data for bar chart (rentals by category)
  const rentalData = Object.entries(analytics.category_rentals)
    .map(([category, count]) => ({
      category: getCategoryLabel(category as any),
      rentals: count,
      items: analytics.category_items[category] || 0,
    }))
    .sort((a, b) => b.rentals - a.rentals);

  // Prepare data for pie chart (inventory distribution vs rental share)
  const pieData = Object.entries(analytics.category_items)
    .map(([category, count]) => ({
      name: getCategoryLabel(category as any),
      value: count,
      rentals: analytics.category_rentals[category] || 0,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Bar Chart: Rentals by Category */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3Icon className="h-5 w-5" />
            <span>Ausleihen nach Kategorie</span>
          </CardTitle>
          <CardDescription>
            Gesamtanzahl der Ausleihen pro Kategorie
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rentalData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rentalData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value, name) => {
                    if (name === 'rentals') return [value, 'Ausleihen'];
                    if (name === 'items') return [value, 'Gegenstände'];
                    return [value, name];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  formatter={(value) => {
                    if (value === 'rentals') return 'Ausleihen';
                    if (value === 'items') return 'Gegenstände';
                    return value;
                  }}
                />
                <Bar dataKey="rentals" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Keine Daten verfügbar
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pie Chart: Inventory Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            <span>Bestandsverteilung</span>
          </CardTitle>
          <CardDescription>
            Anzahl der Gegenstände pro Kategorie
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value, name, props) => {
                    if (name === 'value') {
                      const rentals = props.payload.rentals;
                      return [
                        `${value} Gegenstände, ${rentals} Ausleihen`,
                        props.payload.name
                      ];
                    }
                    return [value, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Keine Daten verfügbar
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
