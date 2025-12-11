/**
 * Sequential Mode - Step 4: Summary
 * Display Pfand amount prominently for writing on envelope
 */

'use client';

import { useEffect } from 'react';
import { useSequentialMode } from '@/hooks/use-sequential-mode';
import { formatCurrency } from '@/lib/utils/formatting';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export function SummaryStep() {
  const { selectedCustomer, selectedItems, expectedDate, totalDeposit, setOpen, reset } =
    useSequentialMode();

  // Handle Enter key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDismiss = () => {
    reset();
    setOpen(false);
  };

  const formatDateDisplay = (date: Date): string => {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      {/* Main Pfand Display */}
      <div className="mb-12">
        <div className="text-center mb-4">
          <h2 className="text-3xl font-bold text-muted-foreground mb-2">Pfand:</h2>
        </div>
        <div className="relative">
          <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
          <div className="relative bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-2xl p-12 shadow-2xl border-4 border-primary">
            <div className="text-7xl font-bold tabular-nums text-center">
              {formatCurrency(totalDeposit)}
            </div>
          </div>
        </div>
      </div>

      {/* Subtitle */}
      <div className="text-2xl font-semibold text-muted-foreground mb-12">
        Bitte auf Umschlag notieren
      </div>

      {/* Summary Details */}
      <div className="w-full max-w-md space-y-4 bg-muted/30 rounded-lg p-6">
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-muted-foreground font-medium">Nutzer:</span>
          <span className="font-semibold text-lg">
            #{String(selectedCustomer?.iid).padStart(4, '0')} {selectedCustomer?.firstname}{' '}
            {selectedCustomer?.lastname}
          </span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-muted-foreground font-medium">Artikel:</span>
          <span className="font-semibold text-lg">
            {selectedItems.map(({ item }) => `#${String(item.iid).padStart(4, '0')}`).join(', ')}
          </span>
        </div>

        <div className="flex justify-between items-center py-2">
          <span className="text-muted-foreground font-medium">Rückgabe:</span>
          <span className="font-semibold text-lg">{formatDateDisplay(expectedDate)}</span>
        </div>
      </div>

      {/* Dismiss button */}
      <Button
        type="button"
        onClick={handleDismiss}
        size="lg"
        className="mt-12 h-16 px-8 text-xl"
        autoFocus
      >
        <CheckCircle2 className="mr-2 h-6 w-6" />
        Fertig
      </Button>

      {/* Keyboard hint */}
      <div className="mt-4 text-muted-foreground text-sm">
        Drücken Sie Enter oder klicken Sie auf Fertig
      </div>
    </div>
  );
}
