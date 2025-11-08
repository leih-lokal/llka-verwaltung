/**
 * Label preview component with multiple design variants
 */

'use client';

import { useState, useRef } from 'react';
import { Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label as UILabel } from '@/components/ui/label';
import { type Item } from '@/types';
import { type LabelType } from '@/app/(dashboard)/label-designer/page';
import { DefaultLabel } from './labels/default-label';
import { CompactLabel } from './labels/compact-label';
import { CordLabel } from './labels/cord-label';
import { toPng, toJpeg, toBlob } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

interface LabelPreviewProps {
  items: Item[];
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

export function LabelPreview({ items, labelType, onLabelTypeChange }: LabelPreviewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    setIsPrinting(true);
    // Use setTimeout to allow state to update before printing
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const getLabelElements = () => {
    if (!labelRef.current) {
      toast.error('Etikett konnte nicht gefunden werden');
      return null;
    }

    const labelElements = Array.from(
      labelRef.current.querySelectorAll('.label-print-area')
    ) as HTMLElement[];

    if (labelElements.length === 0) {
      toast.error('Label elements not found');
      return null;
    }

    return labelElements;
  };

  const waitForFontsToLoad = async () => {
    // Wait for all fonts to be loaded
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    // Extra delay to ensure fonts are fully rendered
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  const handleDownloadPNG = async () => {
    setIsDownloading(true);
    try {
      const labelElements = getLabelElements();
      if (!labelElements) return;

      // Wait for fonts to load before capturing
      await waitForFontsToLoad();

      for (let i = 0; i < labelElements.length; i++) {
        const labelElement = labelElements[i];
        const item = items[i];

        const dataUrl = await toPng(labelElement, {
          cacheBust: true,
          backgroundColor: '#ffffff',
          pixelRatio: 3, // Higher quality
        });

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `label-${String(item.iid).padStart(4, '0')}-${labelType}.png`;
        link.click();

        // Small delay between downloads to avoid browser blocking
        if (i < labelElements.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      toast.success(`${labelElements.length} PNG-Dateien heruntergeladen`);
    } catch (error) {
      console.error('Error downloading PNG:', error);
      toast.error('Fehler beim Herunterladen der PNG-Dateien');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadJPG = async () => {
    setIsDownloading(true);
    try {
      const labelElements = getLabelElements();
      if (!labelElements) return;

      // Wait for fonts to load before capturing
      await waitForFontsToLoad();

      for (let i = 0; i < labelElements.length; i++) {
        const labelElement = labelElements[i];
        const item = items[i];

        const dataUrl = await toJpeg(labelElement, {
          cacheBust: true,
          backgroundColor: '#ffffff',
          quality: 0.95,
          pixelRatio: 3,
        });

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `label-${String(item.iid).padStart(4, '0')}-${labelType}.jpg`;
        link.click();

        // Small delay between downloads to avoid browser blocking
        if (i < labelElements.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      toast.success(`${labelElements.length} JPG-Dateien heruntergeladen`);
    } catch (error) {
      console.error('Error downloading JPG:', error);
      toast.error('Fehler beim Herunterladen der JPG-Dateien');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const labelElements = getLabelElements();
      if (!labelElements) return;

      // Wait for fonts to load before capturing
      await waitForFontsToLoad();

      // Create PDF with 100mm x 50mm dimensions
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [100, 50],
      });

      for (let i = 0; i < labelElements.length; i++) {
        const labelElement = labelElements[i];

        const dataUrl = await toPng(labelElement, {
          cacheBust: true,
          backgroundColor: '#ffffff',
          pixelRatio: 3,
        });

        // Add new page for all labels except the first one
        if (i > 0) {
          pdf.addPage([100, 50], 'landscape');
        }

        pdf.addImage(dataUrl, 'PNG', 0, 0, 100, 50);
      }

      // Generate filename based on range or single item
      const filename = items.length === 1
        ? `label-${String(items[0].iid).padStart(4, '0')}-${labelType}.pdf`
        : `labels-${String(items[0].iid).padStart(4, '0')}-to-${String(items[items.length - 1].iid).padStart(4, '0')}-${labelType}.pdf`;

      pdf.save(filename);
      toast.success(`PDF mit ${labelElements.length} Etiketten heruntergeladen`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Fehler beim Herunterladen der PDF-Datei');
    } finally {
      setIsDownloading(false);
    }
  };

  const renderLabel = (item: Item) => {
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
        <UILabel>Vorschau {items.length > 1 && `(${items.length} Etiketten)`}</UILabel>
        <div className="border-2 border-dashed border-border p-8 bg-muted/20 overflow-auto max-h-[600px]">
          <div ref={labelRef} className="space-y-8">
            {items.map((item, index) => (
              <div key={`${item.id}-${index}`} className="border-1 border">
                {renderLabel(item)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Button onClick={handlePrint} variant="default">
          <Printer className="mr-2 h-4 w-4" />
          Drucken
        </Button>
        <Button
          onClick={handleDownloadPNG}
          variant="outline"
          disabled={isDownloading}
        >
          <Download className="mr-2 h-4 w-4" />
          PNG
        </Button>
        <Button
          onClick={handleDownloadJPG}
          variant="outline"
          disabled={isDownloading}
        >
          <Download className="mr-2 h-4 w-4" />
          JPG
        </Button>
        <Button
          onClick={handleDownloadPDF}
          variant="outline"
          disabled={isDownloading}
        >
          <Download className="mr-2 h-4 w-4" />
          PDF
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
