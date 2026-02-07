/**
 * Customer picker popover for creating bookings after drag selection
 * Positioned at the mouse-up location
 */

'use client';

import { useState, useEffect } from 'react';
import { UserIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { collections } from '@/lib/pocketbase/client';
import type { Customer } from '@/types';

interface CustomerPickerPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Anchor position (x, y) in viewport coordinates */
  anchorPosition: { x: number; y: number } | null;
  onSelect: (customer: Customer | null, manualName?: string) => void;
}

export function CustomerPickerPopover({
  open,
  onOpenChange,
  anchorPosition,
  onSelect,
}: CustomerPickerPopoverProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [manualName, setManualName] = useState('');

  // Reset state when popover opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setResults([]);
      setManualName('');
    }
  }, [open]);

  // Search customers with debounce
  useEffect(() => {
    if (!search || search.length < 2) {
      setResults([]);
      return;
    }

    const searchCustomers = async () => {
      setIsSearching(true);
      try {
        const filters = [];
        let sortBy = 'lastname,firstname';

        if (/^\d+$/.test(search)) {
          filters.push(`iid=${parseInt(search, 10)}`);
          sortBy = 'iid';
        } else {
          const trimmed = search.trim();
          if (trimmed.includes(' ')) {
            const parts = trimmed.split(/\s+/);
            const firstName = parts[0];
            const lastName = parts.slice(1).join(' ');
            filters.push(
              `(firstname~'${firstName}' && lastname~'${lastName}')`
            );
            filters.push(
              `(firstname~'${lastName}' && lastname~'${firstName}')`
            );
          }
          filters.push(`firstname~'${trimmed}'`);
          filters.push(`lastname~'${trimmed}'`);
        }

        const filter = filters.join(' || ');
        const result = await collections
          .customers()
          .getList<Customer>(1, 20, { filter, sort: sortBy });
        setResults(result.items);
      } catch (err) {
        console.error('Error searching customers:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSelectCustomer = (customer: Customer) => {
    onSelect(customer);
    onOpenChange(false);
  };

  const handleManualSubmit = () => {
    if (manualName.trim()) {
      onSelect(null, manualName.trim());
      onOpenChange(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor
        className="fixed pointer-events-none w-0 h-0"
        style={{
          left: anchorPosition?.x ?? 0,
          top: anchorPosition?.y ?? 0,
        }}
      />
      <PopoverContent
        className="w-80 p-0"
        side="right"
        align="start"
        sideOffset={8}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Nutzer:in suchen (Name, Nr)..."
            value={search}
            onValueChange={setSearch}
            autoFocus
          />
          <CommandList>
            {isSearching ? (
              <div className="py-6 text-center text-sm">Suche...</div>
            ) : results.length === 0 && search.length >= 2 ? (
              <CommandEmpty>Kein/e Nutzer:in gefunden.</CommandEmpty>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Tippen Sie, um zu suchen...
              </div>
            ) : (
              <CommandGroup heading="Nutzer:innen">
                {results.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => handleSelectCustomer(customer)}
                    className="group"
                  >
                    <span className="font-mono text-primary font-semibold mr-2 group-aria-selected:text-white">
                      #{String(customer.iid).padStart(4, '0')}
                    </span>
                    <span className="group-aria-selected:text-white">
                      {customer.firstname} {customer.lastname}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <div className="p-2 space-y-2">
              <Label className="text-xs text-muted-foreground">
                Oder Name manuell eingeben:
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Name..."
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleManualSubmit();
                    }
                  }}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManualSubmit}
                  disabled={!manualName.trim()}
                  className="h-8"
                >
                  <UserIcon className="h-3 w-3 mr-1" />
                  OK
                </Button>
              </div>
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
