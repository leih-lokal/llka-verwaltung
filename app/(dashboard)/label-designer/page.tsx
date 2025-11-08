/**
 * Label Designer Page
 * Generate printable labels for items with QR codes
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ItemSelector } from '@/components/label-designer/item-selector';
import { LabelPreview } from '@/components/label-designer/label-preview';
import { type Item } from '@/types';
import { pb } from '@/lib/pocketbase/client';
import { toast } from 'sonner';

export type LabelType = 'default' | 'compact' | 'cord';
type SelectionMode = 'single' | 'multi';

export default function LabelDesignerPage() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<SelectionMode>('single');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  const [selectedLabelType, setSelectedLabelType] = useState<LabelType>('default');
  const [startId, setStartId] = useState<string>('');
  const [endId, setEndId] = useState<string>('');
  const [isLoadingRange, setIsLoadingRange] = useState(false);

  // Load item from URL parameter
  useEffect(() => {
    const itemId = searchParams.get('itemId');
    if (itemId) {
      const fetchItem = async () => {
        try {
          const item = await pb.collection('item').getOne<Item>(itemId);
          setSelectedItem(item);
          setMode('single');
        } catch (error) {
          console.error('Error loading item:', error);
          toast.error('Fehler beim Laden des Artikels');
        }
      };
      fetchItem();
    }
  }, [searchParams]);

  const handleFetchRange = async () => {
    if (!startId || !endId) {
      toast.error('Bitte Start- und End-ID eingeben');
      return;
    }

    const start = parseInt(startId, 10);
    const end = parseInt(endId, 10);

    if (isNaN(start) || isNaN(end)) {
      toast.error('Ungültige ID-Werte');
      return;
    }

    if (start > end) {
      toast.error('Start-ID muss kleiner oder gleich End-ID sein');
      return;
    }

    setIsLoadingRange(true);
    try {
      // Fetch all items in the range
      const items: Item[] = [];
      for (let iid = start; iid <= end; iid++) {
        try {
          const item = await pb.collection('item').getFirstListItem<Item>(
            `iid = ${iid} && status != "deleted"`
          );
          items.push(item);
        } catch (error) {
          // Item doesn't exist, skip it
          console.log(`Item with iid ${iid} not found, skipping`);
        }
      }

      if (items.length === 0) {
        toast.error('Keine Artikel im angegebenen Bereich gefunden');
      } else {
        setSelectedItems(items);
        toast.success(`${items.length} Artikel gefunden`);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Fehler beim Laden der Artikel');
    } finally {
      setIsLoadingRange(false);
    }
  };

  const displayItems = mode === 'single'
    ? (selectedItem ? [selectedItem] : [])
    : selectedItems;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            <span>Label Designer</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Selector */}
          <div className="space-y-3">
            <Label>Auswahlmodus</Label>
            <RadioGroup
              value={mode}
              onValueChange={(value) => {
                setMode(value as SelectionMode);
                // Clear selections when switching modes
                setSelectedItem(null);
                setSelectedItems([]);
              }}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single" id="single" />
                <Label htmlFor="single" className="font-normal cursor-pointer">
                  Einzelauswahl
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="multi" id="multi" />
                <Label htmlFor="multi" className="font-normal cursor-pointer">
                  Bereichsauswahl
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Single Item Selector */}
          {mode === 'single' && (
            <ItemSelector
              selectedItem={selectedItem}
              onItemSelect={setSelectedItem}
            />
          )}

          {/* ID Range Inputs */}
          {mode === 'multi' && (
            <div className="space-y-3">
              <Label>ID-Bereich</Label>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label htmlFor="start-id" className="text-sm text-muted-foreground">
                    Start-ID
                  </Label>
                  <Input
                    id="start-id"
                    type="number"
                    placeholder="z.B. 40"
                    value={startId}
                    onChange={(e) => setStartId(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="end-id" className="text-sm text-muted-foreground">
                    End-ID
                  </Label>
                  <Input
                    id="end-id"
                    type="number"
                    placeholder="z.B. 126"
                    value={endId}
                    onChange={(e) => setEndId(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleFetchRange}
                  disabled={isLoadingRange}
                >
                  {isLoadingRange ? 'Lädt...' : 'Artikel laden'}
                </Button>
              </div>
              {selectedItems.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedItems.length} Artikel ausgewählt
                </p>
              )}
            </div>
          )}

          {displayItems.length > 0 && (
            <LabelPreview
              items={displayItems}
              labelType={selectedLabelType}
              onLabelTypeChange={setSelectedLabelType}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
