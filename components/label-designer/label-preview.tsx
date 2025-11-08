/**
 * Label preview component with multiple design variants
 */

'use client';

import { useState } from 'react';
import { Printer, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label as UILabel } from '@/components/ui/label';
import { type Item } from '@/types';
import { type LabelType } from '@/app/(dashboard)/label-designer/page';
import { DefaultLabel } from './labels/default-label';
import { CompactLabel } from './labels/compact-label';
import { CordLabel } from './labels/cord-label';

interface LabelPreviewProps {
  item: Item;
  labelType: LabelType;
  onLabelTypeChange: (type: LabelType) => void;
}

const labelTypeOptions: { value: LabelType; label: string; description: string }[] = [
  {
    value: 'default',
    label: 'Standard',
    description: 'Standard-Etikett mit großem QR-Code',
  },
  {
    value: 'compact',
    label: 'Kompakt',
    description: 'Kompaktes Etikett mit kleinerem QR-Code',
  },
  {
    value: 'cord',
    label: 'Kabel',
    description: 'Schmales Etikett für Kabel und Schnüre',
  },
];

export function LabelPreview({ item, labelType, onLabelTypeChange }: LabelPreviewProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    // Use setTimeout to allow state to update before printing
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const renderLabel = () => {
    switch (labelType) {
      case 'default':
        return <DefaultLabel item={item} />;
      case 'compact':
        return <CompactLabel item={item} />;
      case 'cord':
        return <CordLabel item={item} />;
      default:
        return <DefaultLabel item={item} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Label Type Selection */}
      <div className="space-y-3">
        <UILabel>Etikett-Typ</UILabel>
        <RadioGroup value={labelType} onValueChange={(value) => onLabelTypeChange(value as LabelType)}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {labelTypeOptions.map((option) => (
              <div key={option.value} className="flex items-start space-x-2">
                <RadioGroupItem value={option.value} id={option.value} />
                <div className="flex-1">
                  <UILabel
                    htmlFor={option.value}
                    className="font-medium cursor-pointer"
                  >
                    {option.label}
                  </UILabel>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <UILabel>Vorschau</UILabel>
        <div className="border-2 border-dashed border-border p-8 bg-muted/20 flex items-center justify-center overflow-auto">
          <div className="scale-100 origin-center">
            {renderLabel()}
          </div>
        </div>
      </div>

      {/* Print Button */}
      <div className="flex gap-2">
        <Button onClick={handlePrint} className="flex-1">
          <Printer className="mr-2 h-4 w-4" />
          Drucken
        </Button>
      </div>

      {/* Print Styles - Hidden on screen, shown when printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .label-print-area,
          .label-print-area * {
            visibility: visible;
          }
          .label-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: 100mm 50mm;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
