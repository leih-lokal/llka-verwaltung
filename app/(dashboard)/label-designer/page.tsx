/**
 * Label Designer Page
 * Generate printable labels for items with QR codes
 */

'use client';

import { useState } from 'react';
import { Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemSelector } from '@/components/label-designer/item-selector';
import { LabelPreview } from '@/components/label-designer/label-preview';
import { type Item } from '@/types';

export type LabelType = 'default' | 'compact' | 'cord';

export default function LabelDesignerPage() {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedLabelType, setSelectedLabelType] = useState<LabelType>('default');

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
          <ItemSelector
            selectedItem={selectedItem}
            onItemSelect={setSelectedItem}
          />

          {selectedItem && (
            <LabelPreview
              item={selectedItem}
              labelType={selectedLabelType}
              onLabelTypeChange={setSelectedLabelType}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
