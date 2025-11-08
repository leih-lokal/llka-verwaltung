/**
 * Global command menu (Cmd+K) for searching across all entities
 * Rebuilt from scratch with proper keyboard navigation
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useCommandMenu } from '@/hooks/use-command-menu';
import { collections } from '@/lib/pocketbase/client';
import type { Customer, Item, Reservation, RentalExpanded } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, User, Package, Calendar, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResults {
  customers: Customer[];
  items: Item[];
  reservations: Reservation[];
  rentals: RentalExpanded[];
}

type SearchResultItem = {
  type: 'customer' | 'item' | 'reservation' | 'rental';
  id: string;
  primaryText: string;
  secondaryText?: string;
  metaText?: string;
  icon: typeof User;
};

export function GlobalCommandMenu() {
  const { open, setOpen, navigateTo } = useCommandMenu();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({
    customers: [],
    items: [],
    reservations: [],
    rentals: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Quick navigation items (shown when no query)
  const quickNav = [
    { label: 'Kund:innen', path: '/customers', icon: User },
    { label: 'Gegenstände', path: '/items', icon: Package },
    { label: 'Reservierungen', path: '/reservations', icon: Calendar },
    { label: 'Leihvorgänge', path: '/rentals', icon: FileText },
  ];

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults({ customers: [], items: [], reservations: [], rentals: [] });
      setSelectedIndex(0);
      // Focus input after a brief delay to ensure modal is rendered
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search across all entities
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ customers: [], items: [], reservations: [], rentals: [] });
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const searchTerm = query.toLowerCase();

        // Check if search term is numeric (for IID search with leading zeros)
        const isNumeric = /^\d+$/.test(searchTerm);
        const numericIID = isNumeric ? parseInt(searchTerm, 10) : null;

        // Build filter strings
        const customerFilter = isNumeric
          ? `firstname ~ "${searchTerm}" || lastname ~ "${searchTerm}" || email ~ "${searchTerm}" || phone ~ "${searchTerm}" || iid = ${numericIID}`
          : `firstname ~ "${searchTerm}" || lastname ~ "${searchTerm}" || email ~ "${searchTerm}" || phone ~ "${searchTerm}"`;

        const itemFilter = isNumeric
          ? `name ~ "${searchTerm}" || brand ~ "${searchTerm}" || iid = ${numericIID}`
          : `name ~ "${searchTerm}" || brand ~ "${searchTerm}"`;

        // Search in parallel
        const [customers, items, reservations, rentals] = await Promise.all([
          // Customers: search by name, email, phone, iid
          collections
            .customers()
            .getList<Customer>(1, 5, {
              filter: customerFilter,
              sort: '-created',
            })
            .then((res) => res.items)
            .catch(() => []),

          // Items: search by name, brand, iid
          collections
            .items()
            .getList<Item>(1, 5, {
              filter: itemFilter,
              sort: '-created',
            })
            .then((res) => res.items)
            .catch(() => []),

          // Reservations: search by customer name, phone
          collections
            .reservations()
            .getList<Reservation>(1, 5, {
              filter: `customer_name ~ "${searchTerm}" || customer_phone ~ "${searchTerm}"`,
              sort: '-created',
              expand: 'items',
            })
            .then((res) => res.items)
            .catch(() => []),

          // Rentals: search by customer name
          collections
            .rentals()
            .getList<RentalExpanded>(1, 5, {
              filter: `customer.firstname ~ "${searchTerm}" || customer.lastname ~ "${searchTerm}"`,
              sort: '-created',
              expand: 'customer,items',
            })
            .then((res) => res.items)
            .catch(() => []),
        ]);

        setResults({ customers, items, reservations, rentals });
        setSelectedIndex(0);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Convert results to flat list for keyboard navigation
  const flatResults: SearchResultItem[] = [];

  if (query) {
    // Add customer results
    results.customers.forEach((customer) => {
      flatResults.push({
        type: 'customer',
        id: customer.id,
        primaryText: `${customer.firstname} ${customer.lastname}`,
        secondaryText: customer.email,
        metaText: `#${String(customer.iid).padStart(4, '0')}`,
        icon: User,
      });
    });

    // Add item results
    results.items.forEach((item) => {
      flatResults.push({
        type: 'item',
        id: item.id,
        primaryText: item.name,
        secondaryText: item.brand,
        metaText: `#${String(item.iid).padStart(4, '0')}`,
        icon: Package,
      });
    });

    // Add reservation results
    results.reservations.forEach((reservation) => {
      flatResults.push({
        type: 'reservation',
        id: reservation.id,
        primaryText: reservation.customer_name,
        secondaryText: new Date(reservation.pickup).toLocaleDateString('de-DE'),
        icon: Calendar,
      });
    });

    // Add rental results
    results.rentals.forEach((rental) => {
      flatResults.push({
        type: 'rental',
        id: rental.id,
        primaryText: rental.expand?.customer
          ? `${rental.expand.customer.firstname} ${rental.expand.customer.lastname}`
          : 'Unbekannt',
        secondaryText: new Date(rental.rented_on).toLocaleDateString('de-DE'),
        icon: FileText,
      });
    });
  }

  // Total count by category
  const categoryCount = {
    customers: results.customers.length,
    items: results.items.length,
    reservations: results.reservations.length,
    rentals: results.rentals.length,
  };

  const totalResults = flatResults.length;

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const itemCount = query ? flatResults.length : quickNav.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % itemCount);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + itemCount) % itemCount);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (query && flatResults.length > 0) {
          const selected = flatResults[selectedIndex];
          if (selected) {
            navigateTo(`/${selected.type === 'customer' ? 'customers' : selected.type === 'item' ? 'items' : selected.type === 'reservation' ? 'reservations' : 'rentals'}?id=${selected.id}`);
            setOpen(false);
          }
        } else if (!query && quickNav.length > 0) {
          const selected = quickNav[selectedIndex];
          if (selected) {
            navigateTo(selected.path);
            setOpen(false);
          }
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [query, flatResults, quickNav, selectedIndex, navigateTo, setOpen]
  );

  // Handle item click
  const handleItemClick = (index: number) => {
    if (query && flatResults.length > 0) {
      const selected = flatResults[index];
      if (selected) {
        navigateTo(`/${selected.type === 'customer' ? 'customers' : selected.type === 'item' ? 'items' : selected.type === 'reservation' ? 'reservations' : 'rentals'}?id=${selected.id}`);
        setOpen(false);
      }
    } else if (!query && quickNav.length > 0) {
      const selected = quickNav[index];
      if (selected) {
        navigateTo(selected.path);
        setOpen(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Globale Suche</DialogTitle>
          <DialogDescription>
            Suche nach Kund:innen, Gegenständen, Reservierungen und Leihvorgängen
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="size-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Suche Kund:innen, Gegenstände, Reservierungen, Leihvorgänge..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 shadow-none focus-visible:ring-0 text-base h-auto p-0"
          />
          {isSearching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {/* Quick Navigation (no query) */}
          {!query && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                Schnellnavigation
              </div>
              {quickNav.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.path}
                    ref={selectedIndex === index ? selectedRef : null}
                    onClick={() => handleItemClick(index)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors',
                      selectedIndex === index
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Search Results */}
          {query && (
            <>
              {totalResults === 0 && !isSearching && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Keine Ergebnisse gefunden
                </div>
              )}

              {totalResults > 0 && (
                <div className="p-2">
                  {/* Customers */}
                  {categoryCount.customers > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                        Kund:innen ({categoryCount.customers})
                      </div>
                      {results.customers.map((customer, idx) => {
                        const globalIndex = flatResults.findIndex(
                          (r) => r.type === 'customer' && r.id === customer.id
                        );
                        return (
                          <div
                            key={customer.id}
                            ref={selectedIndex === globalIndex ? selectedRef : null}
                            onClick={() => handleItemClick(globalIndex)}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors',
                              selectedIndex === globalIndex
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            )}
                          >
                            <User className="size-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {customer.firstname} {customer.lastname}
                              </div>
                              {customer.email && (
                                <div className={cn(
                                  "text-xs truncate",
                                  selectedIndex === globalIndex
                                    ? 'text-primary-foreground/80'
                                    : 'text-muted-foreground'
                                )}>
                                  {customer.email}
                                </div>
                              )}
                            </div>
                            <div className={cn(
                              "text-xs font-mono shrink-0",
                              selectedIndex === globalIndex
                                ? 'text-primary-foreground/80'
                                : 'text-muted-foreground'
                            )}>
                              #{String(customer.iid).padStart(4, '0')}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Items */}
                  {categoryCount.items > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground mt-2">
                        Gegenstände ({categoryCount.items})
                      </div>
                      {results.items.map((item) => {
                        const globalIndex = flatResults.findIndex(
                          (r) => r.type === 'item' && r.id === item.id
                        );
                        return (
                          <div
                            key={item.id}
                            ref={selectedIndex === globalIndex ? selectedRef : null}
                            onClick={() => handleItemClick(globalIndex)}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors',
                              selectedIndex === globalIndex
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            )}
                          >
                            <Package className="size-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{item.name}</div>
                              {item.brand && (
                                <div className={cn(
                                  "text-xs truncate",
                                  selectedIndex === globalIndex
                                    ? 'text-primary-foreground/80'
                                    : 'text-muted-foreground'
                                )}>
                                  {item.brand}
                                </div>
                              )}
                            </div>
                            <div className={cn(
                              "text-xs font-mono shrink-0",
                              selectedIndex === globalIndex
                                ? 'text-primary-foreground/80'
                                : 'text-muted-foreground'
                            )}>
                              #{String(item.iid).padStart(4, '0')}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Reservations */}
                  {categoryCount.reservations > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground mt-2">
                        Reservierungen ({categoryCount.reservations})
                      </div>
                      {results.reservations.map((reservation) => {
                        const globalIndex = flatResults.findIndex(
                          (r) => r.type === 'reservation' && r.id === reservation.id
                        );
                        return (
                          <div
                            key={reservation.id}
                            ref={selectedIndex === globalIndex ? selectedRef : null}
                            onClick={() => handleItemClick(globalIndex)}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors',
                              selectedIndex === globalIndex
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            )}
                          >
                            <Calendar className="size-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {reservation.customer_name}
                              </div>
                            </div>
                            <div className={cn(
                              "text-xs shrink-0",
                              selectedIndex === globalIndex
                                ? 'text-primary-foreground/80'
                                : 'text-muted-foreground'
                            )}>
                              {new Date(reservation.pickup).toLocaleDateString('de-DE')}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Rentals */}
                  {categoryCount.rentals > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground mt-2">
                        Leihvorgänge ({categoryCount.rentals})
                      </div>
                      {results.rentals.map((rental) => {
                        const globalIndex = flatResults.findIndex(
                          (r) => r.type === 'rental' && r.id === rental.id
                        );
                        return (
                          <div
                            key={rental.id}
                            ref={selectedIndex === globalIndex ? selectedRef : null}
                            onClick={() => handleItemClick(globalIndex)}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors',
                              selectedIndex === globalIndex
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            )}
                          >
                            <FileText className="size-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {rental.expand?.customer
                                  ? `${rental.expand.customer.firstname} ${rental.expand.customer.lastname}`
                                  : 'Unbekannt'}
                              </div>
                            </div>
                            <div className={cn(
                              "text-xs shrink-0",
                              selectedIndex === globalIndex
                                ? 'text-primary-foreground/80'
                                : 'text-muted-foreground'
                            )}>
                              {new Date(rental.rented_on).toLocaleDateString('de-DE')}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {/* Results footer */}
              {totalResults > 0 && (
                <div className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
                  {totalResults} Ergebnis{totalResults !== 1 ? 'se' : ''} gefunden
                </div>
              )}
            </>
          )}
        </div>

        {/* Keyboard hints */}
        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↑↓</kbd>
              <span>Navigieren</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↵</kbd>
              <span>Auswählen</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd>
              <span>Schließen</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
