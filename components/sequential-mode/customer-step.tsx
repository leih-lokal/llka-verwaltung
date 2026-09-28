/**
 * Sequential Mode - Step 1: Customer Selection
 * Large search interface for selecting a customer
 */

'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { Input } from '@/components/ui/input';
import { User, Loader2 } from 'lucide-react';
import { collections, pb } from '@/lib/pocketbase/client';
import { buildCustomerSearchFilter } from '@/lib/filters/filter-utils';
import type { Customer } from '@/types';
import { cn } from '@/lib/utils';
import { useSequentialMode } from '@/hooks/use-sequential-mode';

export function CustomerStep() {
  const { setSelectedCustomer, goNext } = useSequentialMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const isNumeric = /^\d+$/.test(searchQuery);

        // Shared iid / name search, plus a fuzzy email match
        const filters = [buildCustomerSearchFilter(searchQuery)];
        if (isNumeric) {
          // The shared helper only matches the iid for digits; keep the name/email match too
          filters.push(pb.filter('firstname ~ {:q} || lastname ~ {:q} || email ~ {:q}', { q: searchQuery }));
        } else {
          filters.push(pb.filter('email ~ {:q}', { q: searchQuery.trim() }));
        }

        const filter = filters.join(' || ');

        const result = await collections.customers().getList<Customer>(1, 20, {
          filter,
          sort: isNumeric ? '-iid' : 'lastname,firstname', // Prioritize IID if numeric search
        });

        setResults(result.items);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Error searching customers:', err);
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
        handleSelectCustomer(results[selectedIndex]);
      }
    }
  };

  // Handle customer selection
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    goNext(); // Auto-advance to items step
  };

  // The input stays focused while arrow keys move through the results, so it
  // is a combobox pointing at the highlighted option
  const showResults = !isSearching && results.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="mb-6">
        <Input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Nutzer:in suchen"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={showResults ? listboxId : undefined}
          aria-activedescendant={showResults ? optionId(selectedIndex) : undefined}
          placeholder="Name oder Nummer eingeben..."
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
            Kein/e Nutzer:in gefunden
          </div>
        )}

        {!isSearching && searchQuery.length < 2 && (
          <div className="text-center py-12 text-muted-foreground">
            Tippen Sie mindestens 2 Zeichen, um zu suchen
          </div>
        )}

        {showResults && (
          <div id={listboxId} role="listbox" aria-label="Nutzer:innen" className="space-y-2">
            {results.map((customer, index) => (
              <div
                key={customer.id}
                id={optionId(index)}
                role="option"
                aria-selected={selectedIndex === index}
                ref={selectedIndex === index ? selectedRef : null}
                onClick={() => handleSelectCustomer(customer)}
                className={cn(
                  'p-4 rounded-lg cursor-pointer transition-all border-2',
                  selectedIndex === index
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-[1.02]'
                    : 'bg-muted/50 hover:bg-muted border-transparent'
                )}
              >
                <div className="flex items-center gap-4">
                  <User className="h-6 w-6 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 mb-1">
                      <span
                        className={cn(
                          'font-mono font-bold text-xl tabular-nums',
                          selectedIndex === index ? 'text-primary-foreground' : 'text-red-600'
                        )}
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        #{String(customer.iid).padStart(4, '0')}
                      </span>
                      <span className="font-semibold text-lg truncate">
                        {customer.firstname} {customer.lastname}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'text-sm',
                        selectedIndex === index
                          ? 'text-primary-foreground/80'
                          : 'text-muted-foreground'
                      )}
                    >
                      {customer.email && <span>{customer.email}</span>}
                      {customer.phone && customer.email && <span className="mx-2">•</span>}
                      {customer.phone && <span>{customer.phone}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
