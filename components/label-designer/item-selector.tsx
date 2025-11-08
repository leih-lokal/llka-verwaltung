/**
 * Item selector component for label designer
 */

'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { pb } from '@/lib/pocketbase/client';
import { type Item } from '@/types';
import { toast } from 'sonner';

interface ItemSelectorProps {
  selectedItem: Item | null;
  onItemSelect: (item: Item | null) => void;
}

export function ItemSelector({ selectedItem, onItemSelect }: ItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const records = await pb.collection('item').getFullList<Item>({
          sort: 'iid',
          filter: 'status != "deleted"',
        });
        setItems(records);
      } catch (error) {
        console.error('Error fetching items:', error);
        toast.error('Fehler beim Laden der Gegenstände');
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  const formatItemLabel = (item: Item) => {
    return `#${String(item.iid).padStart(4, '0')} - ${item.name}`;
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Gegenstand auswählen</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedItem ? (
              formatItemLabel(selectedItem)
            ) : (
              <span className="text-muted-foreground">
                Gegenstand auswählen...
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-0">
          <Command>
            <CommandInput placeholder="Gegenstand suchen..." />
            <CommandList>
              <CommandEmpty>
                {loading ? 'Lädt...' : 'Keine Gegenstände gefunden.'}
              </CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.iid} ${item.name} ${item.brand || ''} ${item.model || ''}`}
                    onSelect={() => {
                      onItemSelect(item);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedItem?.id === item.id
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    {formatItemLabel(item)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
