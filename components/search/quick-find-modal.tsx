/**
 * Global quick find modal for 4-digit ID search
 * Activated with Cmd+P or Cmd+Shift+F
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuickFind } from '@/hooks/use-quick-find';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { CustomerDetailSheet } from '@/components/detail-sheets/customer-detail-sheet';
import { ItemDetailSheet } from '@/components/detail-sheets/item-detail-sheet';
import { RentalDetailSheet } from '@/components/detail-sheets/rental-detail-sheet';
import { ReservationDetailSheet } from '@/components/detail-sheets/reservation-detail-sheet';
import { collections } from '@/lib/pocketbase/client';
import type {
  Customer,
  Item,
  Rental,
  RentalExpanded,
  Reservation,
  ReservationExpanded,
} from '@/types';
import { Loader2, UserIcon, PackageIcon, RepeatIcon, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResults {
  customers: Customer[];
  items: Item[];
  rentals: RentalExpanded[];
  reservations: ReservationExpanded[];
}

type SelectedEntity =
  | { type: 'customer'; data: Customer }
  | { type: 'item'; data: Item }
  | { type: 'rental'; data: RentalExpanded }
  | { type: 'reservation'; data: ReservationExpanded }
  | null;

export function QuickFindModal() {
  const { open, setOpen } = useQuickFind();
  const [value, setValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResults>({
    customers: [],
    items: [],
    rentals: [],
    reservations: [],
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setValue('');
      setResults({ customers: [], items: [], rentals: [], reservations: [] });
      setSelectedIndex(0);
    }
  }, [open]);

  // Perform search when 4 digits are entered
  useEffect(() => {
    if (value.length !== 4) {
      setResults({ customers: [], items: [], rentals: [], reservations: [] });
      return;
    }

    const iid = parseInt(value, 10);
    if (isNaN(iid)) return;

    const searchAll = async () => {
      setIsSearching(true);
      try {
        const [customers, items, rentals, reservations] = await Promise.all([
          // Search customers by IID
          collections
            .customers()
            .getList<Customer>(1, 10, {
              filter: `iid = ${iid}`,
            })
            .then((res) => res.items)
            .catch(() => []),

          // Search items by IID
          collections
            .items()
            .getList<Item>(1, 10, {
              filter: `iid = ${iid}`,
            })
            .then((res) => res.items)
            .catch(() => []),

          // Search rentals by customer IID or item IID
          collections
            .rentals()
            .getList<RentalExpanded>(1, 20, {
              expand: 'customer,items',
              filter: `expand.customer.iid = ${iid} || expand.items.iid ?= ${iid}`,
              sort: '-created',
            })
            .then((res) => res.items)
            .catch(() => []),

          // Search reservations by customer IID or item IID
          collections
            .reservations()
            .getList<ReservationExpanded>(1, 20, {
              expand: 'items',
              filter: `customer_iid = ${iid} || expand.items.iid ?= ${iid}`,
              sort: '-created',
            })
            .then((res) => res.items)
            .catch(() => []),
        ]);

        setResults({ customers, items, rentals, reservations });
        setSelectedIndex(0);
      } finally {
        setIsSearching(false);
      }
    };

    searchAll();
  }, [value]);

  // Get flat list of all results for keyboard navigation
  const getAllResults = useCallback((): Array<{
    type: 'customer' | 'item' | 'rental' | 'reservation';
    data: Customer | Item | RentalExpanded | ReservationExpanded;
    index: number;
  }> => {
    const allResults: Array<{
      type: 'customer' | 'item' | 'rental' | 'reservation';
      data: Customer | Item | RentalExpanded | ReservationExpanded;
      index: number;
    }> = [];

    let index = 0;
    results.customers.forEach((c) => {
      allResults.push({ type: 'customer', data: c, index: index++ });
    });
    results.items.forEach((i) => {
      allResults.push({ type: 'item', data: i, index: index++ });
    });
    results.rentals.forEach((r) => {
      allResults.push({ type: 'rental', data: r, index: index++ });
    });
    results.reservations.forEach((r) => {
      allResults.push({ type: 'reservation', data: r, index: index++ });
    });

    return allResults;
  }, [results]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const allResults = getAllResults();
      if (allResults.length === 0) return;

      // Arrow key navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, allResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
      // Enter to open selected
      else if (e.key === 'Enter' && allResults[selectedIndex]) {
        e.preventDefault();
        const selected = allResults[selectedIndex];
        handleSelectResult(selected.type, selected.data);
      }
      // Number keys 0-9 for quick selection
      else if (e.key >= '0' && e.key <= '9') {
        const numIndex = parseInt(e.key, 10);
        if (numIndex < allResults.length) {
          e.preventDefault();
          const selected = allResults[numIndex];
          handleSelectResult(selected.type, selected.data);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, getAllResults]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  const handleSelectResult = (
    type: 'customer' | 'item' | 'rental' | 'reservation',
    data: Customer | Item | RentalExpanded | ReservationExpanded
  ) => {
    setSelectedEntity({ type, data } as SelectedEntity);
    setIsSheetOpen(true);
    setOpen(false); // Close the search modal
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setSelectedEntity(null);
  };

  const totalResults =
    results.customers.length +
    results.items.length +
    results.rentals.length +
    results.reservations.length;

  const allResults = getAllResults();

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quick Find</DialogTitle>
            <DialogDescription>
              Enter a 4-digit ID to search across all entities
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6 py-4">
            {/* OTP Input */}
            <div className="flex justify-center">
              <InputOTP
                maxLength={4}
                value={value}
                onChange={setValue}
                autoFocus
              >
                <InputOTPGroup className="gap-3">
                  <InputOTPSlot index={0} className="h-16 w-16 text-2xl font-bold" />
                  <InputOTPSlot index={1} className="h-16 w-16 text-2xl font-bold" />
                  <InputOTPSlot index={2} className="h-16 w-16 text-2xl font-bold" />
                  <InputOTPSlot index={3} className="h-16 w-16 text-2xl font-bold" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {/* Loading state */}
            {isSearching && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Searching...</span>
              </div>
            )}

            {/* Results */}
            {!isSearching && value.length === 4 && totalResults === 0 && (
              <div className="text-center text-muted-foreground text-sm">
                No results found for ID {value}
              </div>
            )}

            {!isSearching && totalResults > 0 && (
              <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto">
                {/* Customers */}
                {results.customers.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                      CUSTOMERS ({results.customers.length})
                    </h3>
                    {results.customers.map((customer, idx) => {
                      const globalIndex = allResults.findIndex(
                        (r) => r.type === 'customer' && r.data.id === customer.id
                      );
                      return (
                        <button
                          key={customer.id}
                          ref={selectedIndex === globalIndex ? selectedRef : null}
                          onClick={() => handleSelectResult('customer', customer)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border-2',
                            selectedIndex === globalIndex
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'border-transparent hover:bg-muted hover:border-border'
                          )}
                        >
                          <UserIcon className={cn(
                            'h-4 w-4',
                            selectedIndex === globalIndex ? 'text-primary-foreground' : 'text-muted-foreground'
                          )} />
                          <div className="flex-1">
                            <div className="font-medium">
                              {customer.firstname} {customer.lastname}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ID: {customer.iid}
                            </div>
                          </div>
                          {globalIndex < 10 && (
                            <kbd className={cn(
                              'px-2 py-1 text-xs rounded font-mono',
                              selectedIndex === globalIndex
                                ? 'bg-primary-foreground text-primary'
                                : 'bg-muted text-muted-foreground'
                            )}>
                              {globalIndex}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Items */}
                {results.items.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                      ITEMS ({results.items.length})
                    </h3>
                    {results.items.map((item) => {
                      const globalIndex = allResults.findIndex(
                        (r) => r.type === 'item' && r.data.id === item.id
                      );
                      return (
                        <button
                          key={item.id}
                          ref={selectedIndex === globalIndex ? selectedRef : null}
                          onClick={() => handleSelectResult('item', item)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border-2',
                            selectedIndex === globalIndex
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'border-transparent hover:bg-muted hover:border-border'
                          )}
                        >
                          <PackageIcon className={cn(
                            'h-4 w-4',
                            selectedIndex === globalIndex ? 'text-primary-foreground' : 'text-muted-foreground'
                          )} />
                          <div className="flex-1">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">
                              ID: {item.iid}
                            </div>
                          </div>
                          {globalIndex < 10 && (
                            <kbd className={cn(
                              'px-2 py-1 text-xs rounded font-mono',
                              selectedIndex === globalIndex
                                ? 'bg-primary-foreground text-primary'
                                : 'bg-muted text-muted-foreground'
                            )}>
                              {globalIndex}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Rentals */}
                {results.rentals.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                      RENTALS ({results.rentals.length})
                    </h3>
                    {results.rentals.map((rental) => {
                      const globalIndex = allResults.findIndex(
                        (r) => r.type === 'rental' && r.data.id === rental.id
                      );
                      return (
                        <button
                          key={rental.id}
                          ref={selectedIndex === globalIndex ? selectedRef : null}
                          onClick={() => handleSelectResult('rental', rental)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border-2',
                            selectedIndex === globalIndex
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'border-transparent hover:bg-muted hover:border-border'
                          )}
                        >
                          <RepeatIcon className={cn(
                            'h-4 w-4',
                            selectedIndex === globalIndex ? 'text-primary-foreground' : 'text-muted-foreground'
                          )} />
                          <div className="flex-1">
                            <div className="font-medium">
                              {rental.expand?.customer?.firstname}{' '}
                              {rental.expand?.customer?.lastname}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {rental.expand?.items?.length || 0} item(s) •{' '}
                              {new Date(rental.rented_on).toLocaleDateString()}
                            </div>
                          </div>
                          {globalIndex < 10 && (
                            <kbd className={cn(
                              'px-2 py-1 text-xs rounded font-mono',
                              selectedIndex === globalIndex
                                ? 'bg-primary-foreground text-primary'
                                : 'bg-muted text-muted-foreground'
                            )}>
                              {globalIndex}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Reservations */}
                {results.reservations.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                      RESERVATIONS ({results.reservations.length})
                    </h3>
                    {results.reservations.map((reservation) => {
                      const globalIndex = allResults.findIndex(
                        (r) => r.type === 'reservation' && r.data.id === reservation.id
                      );
                      return (
                        <button
                          key={reservation.id}
                          ref={selectedIndex === globalIndex ? selectedRef : null}
                          onClick={() => handleSelectResult('reservation', reservation)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border-2',
                            selectedIndex === globalIndex
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'border-transparent hover:bg-muted hover:border-border'
                          )}
                        >
                          <CalendarIcon className={cn(
                            'h-4 w-4',
                            selectedIndex === globalIndex ? 'text-primary-foreground' : 'text-muted-foreground'
                          )} />
                          <div className="flex-1">
                            <div className="font-medium">
                              {reservation.customer_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {reservation.expand?.items?.length || 0} item(s) •{' '}
                              {new Date(reservation.pickup).toLocaleDateString()}
                            </div>
                          </div>
                          {globalIndex < 10 && (
                            <kbd className={cn(
                              'px-2 py-1 text-xs rounded font-mono',
                              selectedIndex === globalIndex
                                ? 'bg-primary-foreground text-primary'
                                : 'bg-muted text-muted-foreground'
                            )}>
                              {globalIndex}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Keyboard shortcuts hint */}
            {totalResults > 0 && (
              <div className="text-xs text-muted-foreground text-center">
                Use ↑↓ or 0-9 to select • Enter to open
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Sheets */}
      {selectedEntity?.type === 'customer' && (
        <CustomerDetailSheet
          customer={selectedEntity.data as Customer}
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          onSave={(updated) => {
            // Optionally refresh the search results
            handleCloseSheet();
          }}
        />
      )}

      {selectedEntity?.type === 'item' && (
        <ItemDetailSheet
          item={selectedEntity.data as Item}
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          onSave={(updated) => {
            handleCloseSheet();
          }}
        />
      )}

      {selectedEntity?.type === 'rental' && (
        <RentalDetailSheet
          rental={selectedEntity.data as RentalExpanded}
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          onSave={(updated) => {
            handleCloseSheet();
          }}
        />
      )}

      {selectedEntity?.type === 'reservation' && (
        <ReservationDetailSheet
          reservation={selectedEntity.data as ReservationExpanded}
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          onSave={(updated) => {
            handleCloseSheet();
          }}
        />
      )}
    </>
  );
}
