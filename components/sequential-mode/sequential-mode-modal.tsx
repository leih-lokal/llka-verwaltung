/**
 * Sequential Mode Modal
 * Main container for the keyboard-driven rental flow
 */

'use client';

import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSequentialMode } from '@/hooks/use-sequential-mode';
import { CustomerStep } from './customer-step';
import { ItemsStep } from './items-step';
import { FinalizeStep } from './finalize-step';
import { SummaryStep } from './summary-step';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

function ProgressIndicator({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  const steps = [
    { num: 1, label: 'Nutzer' },
    { num: 2, label: 'Artikel' },
    { num: 3, label: 'Finalisieren' },
    { num: 4, label: 'Fertig' },
  ];

  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-all',
              step.num === currentStep
                ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
                : step.num < currentStep
                  ? 'bg-green-600 text-white'
                  : 'bg-muted text-muted-foreground'
            )}
          >
            {step.num < currentStep ? <CheckCircle2 className="h-5 w-5" /> : step.num}
          </div>
          <span
            className={cn(
              'text-sm font-medium transition-all',
              step.num === currentStep
                ? 'text-foreground font-semibold'
                : 'text-muted-foreground'
            )}
          >
            {step.label}
          </span>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'h-0.5 w-12 transition-all',
                step.num < currentStep ? 'bg-green-600' : 'bg-border'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function KeyboardHints({ step }: { step: 1 | 2 | 3 | 4 }) {
  // Step 4 (summary) doesn't need hints - it handles itself
  if (step === 4) return null;

  return (
    <div className="border-t pt-4 mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">↵</kbd>
        <span>Weiter</span>
      </div>
      {step > 1 && step < 4 && (
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">←</kbd>
          <span>Zurück</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">ESC</kbd>
        <span>Abbrechen</span>
      </div>
    </div>
  );
}

export function SequentialModeModal() {
  const { open, setOpen, step, goBack } = useSequentialMode();

  // Handle ESC to close (cancel without confirmation)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'Backspace' && step > 1 && step < 4) {
        // Don't trigger if user is typing in an input
        const activeElement = document.activeElement;
        if (
          activeElement?.tagName !== 'INPUT' &&
          activeElement?.tagName !== 'TEXTAREA'
        ) {
          e.preventDefault();
          goBack();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, step, setOpen, goBack]);

  // Get step title
  const getStepTitle = () => {
    switch (step) {
      case 1:
        return 'Nutzer auswählen';
      case 2:
        return 'Artikel hinzufügen';
      case 3:
        return 'Rückgabe & Bestätigung';
      case 4:
        return 'Pfand notieren';
      default:
        return 'Sequential Mode';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-7xl h-[85vh] flex flex-col p-8"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-3xl font-bold text-center mb-2">
            {getStepTitle()}
          </DialogTitle>
          <ProgressIndicator currentStep={step} />
        </DialogHeader>

        {/* Step Content */}
        <div className="flex-1 overflow-hidden">
          {step === 1 && <CustomerStep />}
          {step === 2 && <ItemsStep />}
          {step === 3 && <FinalizeStep onSuccess={() => {}} />}
          {step === 4 && <SummaryStep />}
        </div>

        {/* Keyboard Hints */}
        <KeyboardHints step={step} />
      </DialogContent>
    </Dialog>
  );
}
