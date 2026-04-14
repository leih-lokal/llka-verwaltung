/**
 * Sequential Mode - Step 2: Items Selection
 * Multi-item selection with quantity support and preview panel
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Package, Loader2, X, Plus, Minus, ChevronRight } from 'lucide-react';
import { collections, pb } from '@/lib/pocketbase/client';
import type { Item } from '@/types';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatting';
import { useSequentialMode } from '@/hooks/use-sequential-mode';
import { toast } from 'sonner';

export function ItemsStep() {
  const { selectedItems, addItem, removeItem, updateItemQuantity, goNext } = useSequentialMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingQuantity, setPendingQuantity] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search - only instock and reserved items
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const filters = [];
        const isNumeric = /^\d+$/.test(searchQuery);

        if (isNumeric) {
          filters.push(`iid=${parseInt(searchQuery, 10)}`);
        }

        const q = pb.filter('name ~ {:q} || brand ~ {:q} || model ~ {:q}', { q: searchQuery });
        filters.push(q);

        // Only show available items (instock or reserved)
        const filter = `(${filters.join(' || ')}) && (status='instock' || status='reserved')`;

        const result = await collections.items().getList<Item>(1, 20, {
          filter,
          sort: isNumeric ? '-iid' : 'name',
        });

        setResults(result.items);
        setSelectedIndex(0);
        setPendingQuantity(1); // Reset quantity for new search
      } catch (err) {
        console.error('Error searching items:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !e.shiftKey && selectedItems.length > 0) {
      e.preventDefault();
      goNext();
      return;
    }

    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleAddItem(results[selectedIndex]);
      }
    }
  };

  // Handle item addition
  const handleAddItem = (item: Item) => {
    // Check if already added
    const existing = selectedItems.find((si) => si.item.id === item.id);
    if (existing) {
      toast.warning('Dieser Artikel wurde bereits hinzugefügt');
      return;
    }

    const quantity = item.copies > 1 ? pendingQuantity : 1;
    addItem(item, quantity);

    // Clear search and reset for next item
    setSearchQuery('');
    setResults([]);
    setPendingQuantity(1);
    inputRef.current?.focus();
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Left side: Search */}
      <div className="flex-1 flex flex-col">
        <div className="mb-6">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Artikel-Name oder Nummer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-14 text-2xl border-2 border-primary/20 focus-visible:border-primary"
            autoComplete="off"
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {isSearching && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isSearching && searchQuery.length >= 2 && results.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Kein Artikel gefunden
            </div>
          )}

          {!isSearching && searchQuery.length < 2 && (
            <div className="text-center py-12 text-muted-foreground">
              {selectedItems.length === 0
                ? 'Tippen Sie mindestens 2 Zeichen, um zu suchen'
                : 'Weitere Artikel suchen oder Tab+Enter für weiter'}
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <div className="space-y-2">
              {results.map((item, index) => {
                const hasMultipleCopies = item.copies > 1;

                return (
                  <div
                    key={item.id}
                    ref={selectedIndex === index ? selectedRef : null}
                    onClick={() => handleAddItem(item)}
                    className={cn(
                      'p-4 rounded-lg cursor-pointer transition-all border-2',
                      selectedIndex === index
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-[1.02]'
                        : 'bg-muted/50 hover:bg-muted border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <Package className="h-6 w-6 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-3 mb-1">
                          {/* Two-tone ID badge would go here - simplified for now */}
                          <span
                            className={cn(
                              'font-mono font-bold text-lg',
                              selectedIndex === index
                                ? 'text-primary-foreground'
                                : 'text-primary'
                            )}
                          >
                            #{String(item.iid).padStart(4, '0')}
                          </span>
                          <span className="font-semibold text-lg truncate">{item.name}</span>
                        </div>
                        <div
                          className={cn(
                            'text-sm',
                            selectedIndex === index
                              ? 'text-primary-foreground/80'
                              : 'text-muted-foreground'
                          )}
                        >
                          {item.brand && <span>{item.brand}</span>}
                          {item.model && item.brand && <span className="mx-2">•</span>}
                          {item.model && <span>{item.model}</span>}
                          {hasMultipleCopies && (
                            <>
                              <span className="mx-2">•</span>
                              <span>{item.copies} Exemplare verfügbar</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-lg font-semibold">
                        {formatCurrency(item.deposit || 0)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Continue Button */}
        {selectedItems.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <Button
              type="button"
              onClick={goNext}
              size="lg"
              className="w-full h-14 text-xl"
            >
              Weiter
              <ChevronRight className="ml-2 h-6 w-6" />
            </Button>
          </div>
        )}
      </div>

      {/* Right side: Preview Panel */}
      <div className="w-80 border-l pl-6 flex flex-col">
        <h3 className="text-lg font-semibold mb-4">
          Artikel ({selectedItems.length})
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2">
          {selectedItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Keine Artikel ausgewählt
            </div>
          ) : (
            selectedItems.map(({ item, quantity }) => {
              const hasMultipleCopies = item.copies > 1;
              const totalDeposit = (item.deposit || 0) * quantity;

              return (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm text-primary font-semibold mb-1">
                        #{String(item.iid).padStart(4, '0')}
                      </div>
                      <div className="font-medium text-sm truncate">{item.name}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="h-6 w-6 p-0 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Quantity controls for multi-copy items */}
                  {hasMultipleCopies && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateItemQuantity(item.id, Math.max(1, quantity - 1))}
                          disabled={quantity <= 1}
                          className="h-6 w-6 p-0"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="font-mono font-semibold text-sm w-6 text-center">
                          {quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateItemQuantity(item.id, Math.min(item.copies, quantity + 1))
                          }
                          disabled={quantity >= item.copies}
                          className="h-6 w-6 p-0"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-sm font-medium">
                        {formatCurrency(totalDeposit)}
                      </div>
                    </div>
                  )}

                  {/* Single copy items just show deposit */}
                  {!hasMultipleCopies && (
                    <div className="text-sm font-medium text-muted-foreground">
                      {formatCurrency(item.deposit || 0)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Total */}
        {selectedItems.length > 0 && (
          <div className="mt-4 pt-4 border-t-2 border-primary">
            <div className="flex items-center justify-between bg-primary/10 rounded-lg p-4">
              <span className="text-lg font-semibold text-primary">Gesamt Pfand:</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(
                  selectedItems.reduce(
                    (sum, { item, quantity }) => sum + (item.deposit || 0) * quantity,
                    0
                  )
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
