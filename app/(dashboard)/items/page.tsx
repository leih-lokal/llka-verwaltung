/**
 * Items page
 */

'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { collections } from '@/lib/pocketbase/client';
import type { Item } from '@/types';
import { getItemStatusLabel, ITEM_STATUS_COLORS } from '@/lib/constants/statuses';
import { getCategoryLabel } from '@/lib/constants/categories';

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchItems() {
      try {
        setIsLoading(true);
        const result = await collections.items().getList<Item>(1, 50, {
          sort: '-created',
        });
        setItems(result.items);
        setError(null);
      } catch (err) {
        console.error('Error fetching items:', err);
        setError(
          err instanceof Error ? err.message : 'Fehler beim Laden der Gegenstände'
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchItems();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b-2 border-primary bg-background p-4 flex items-center gap-4">
        <Input
          placeholder="Gegenstände suchen..."
          className="max-w-md"
          disabled
        />
        <span className="text-sm text-muted-foreground ml-auto">
          {items.length} Gegenstände
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive font-medium">Fehler: {error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Bitte überprüfen Sie Ihre PocketBase-Verbindung
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Keine Gegenstände gefunden</p>
          </div>
        ) : (
          <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-primary">
                    <th className="px-4 py-2 text-left font-bold">ID</th>
                    <th className="px-4 py-2 text-left font-bold">Name</th>
                    <th className="px-4 py-2 text-left font-bold">Marke</th>
                    <th className="px-4 py-2 text-left font-bold">Kategorie</th>
                    <th className="px-4 py-2 text-left font-bold">Status</th>
                    <th className="px-4 py-2 text-left font-bold">Kaution</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-sm">
                        {item.iid}
                      </td>
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {item.brand || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.category.length > 0
                          ? item.category.map(getCategoryLabel).join(', ')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ITEM_STATUS_COLORS[item.status]}>
                          {getItemStatusLabel(item.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.deposit > 0 ? `${item.deposit} €` : '—'}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
