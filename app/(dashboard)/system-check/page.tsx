/**
 * System Check Mode page
 * Allows workers to systematically verify active rentals against physical records
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, CheckIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RentalDetailSheet } from '@/components/detail-sheets/rental-detail-sheet';
import { collections } from '@/lib/pocketbase/client';
import { formatDate, calculateRentalStatus } from '@/lib/utils/formatting';
import { getRentalStatusLabel } from '@/lib/constants/statuses';
import type { RentalExpanded } from '@/types';

type SystemCheckState = 'idle' | 'running' | 'completed';

export default function SystemCheckPage() {
  const router = useRouter();
  const [state, setState] = useState<SystemCheckState>('idle');
  const [activeRentals, setActiveRentals] = useState<RentalExpanded[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processedRentalIds, setProcessedRentalIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<RentalExpanded | null>(null);

  // Fetch active rentals on mount
  useEffect(() => {
    fetchActiveRentals();
  }, []);

  const fetchActiveRentals = async () => {
    setIsLoading(true);
    try {
      // Fetch all active rentals (rentals without a return date)
      const result = await collections.rentals().getList<RentalExpanded>(
        1,
        500, // Get up to 500 active rentals
        {
          filter: 'returned_on=""',
          sort: 'rented_on',
          expand: 'customer,items',
        }
      );

      setActiveRentals(result.items);
      setError(null);
    } catch (err) {
      console.error('Error fetching active rentals:', err);
      setError(
        err instanceof Error ? err.message : 'Fehler beim Laden der aktiven Leihvorgänge'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = () => {
    if (activeRentals.length === 0) {
      return;
    }
    setState('running');
    setCurrentIndex(0);
    setProcessedRentalIds(new Set());
  };

  const findNextUnprocessedIndex = (
    rentals: RentalExpanded[],
    startFrom: number = 0,
    processedIds: Set<string> = processedRentalIds
  ): number | null => {
    for (let i = startFrom; i < rentals.length; i++) {
      if (!processedIds.has(rentals[i].id)) {
        return i;
      }
    }
    return null;
  };

  const handleAccept = () => {
    // Mark current rental as processed
    const currentRental = activeRentals[currentIndex];
    if (currentRental) {
      const newProcessedIds = new Set(processedRentalIds);
      newProcessedIds.add(currentRental.id);
      setProcessedRentalIds(newProcessedIds);

      // Find next unprocessed rental
      const nextIndex = findNextUnprocessedIndex(activeRentals, currentIndex + 1, newProcessedIds);
      if (nextIndex !== null) {
        setCurrentIndex(nextIndex);
      } else {
        // All rentals processed
        setState('completed');
      }
    }
  };

  const handleReject = () => {
    // Open the detail sheet for the current rental
    setSelectedRental(activeRentals[currentIndex]);
    setIsSheetOpen(true);
  };

  const handleSheetClose = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      setSelectedRental(null);
    }
  };

  const handleRentalSave = async () => {
    // Mark current rental as processed
    const currentRental = activeRentals[currentIndex];
    if (currentRental) {
      const newProcessedIds = new Set(processedRentalIds);
      newProcessedIds.add(currentRental.id);

      // Refresh the list
      await fetchActiveRentals();

      // Update processed IDs state
      setProcessedRentalIds(newProcessedIds);

      // Use setTimeout to ensure activeRentals state is updated after fetchActiveRentals
      setTimeout(() => {
        // Get the current activeRentals from state by using a callback
        setActiveRentals(currentRentals => {
          // Find next unprocessed rental using the updated processed IDs
          const nextIndex = findNextUnprocessedIndex(currentRentals, 0, newProcessedIds);
          if (nextIndex !== null) {
            setCurrentIndex(nextIndex);
          } else {
            // All rentals processed
            setState('completed');
          }
          return currentRentals;
        });
      }, 100);
    }
  };

  const handleReturnToDashboard = () => {
    router.push('/dashboard');
  };

  const handleRestart = () => {
    setState('idle');
    setCurrentIndex(0);
    setProcessedRentalIds(new Set());
    fetchActiveRentals();
  };

  const currentRental = state === 'running' && activeRentals[currentIndex]
    ? activeRentals[currentIndex]
    : null;

  const progress = state === 'running' && activeRentals.length > 0
    ? `${currentIndex + 1} / ${activeRentals.length}`
    : '';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b-2 border-primary bg-background p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">SYSTEM CHECK MODE</h1>
          <Button
            onClick={handleReturnToDashboard}
            variant="outline"
            size="sm"
          >
            <ArrowLeftIcon className="size-4 mr-2" />
            Zurück zum Dashboard
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive font-medium text-lg">Fehler: {error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Bitte überprüfen Sie Ihre PocketBase-Verbindung
            </p>
            <Button onClick={fetchActiveRentals} className="mt-4">
              Erneut versuchen
            </Button>
          </div>
        ) : state === 'idle' ? (
          // IDLE STATE
          <div className="max-w-4xl mx-auto">
            {/* ASCII Art Logo */}
            <div className="flex justify-center mb-8">
              <img
                src="/SCM.svg"
                alt="System Check Mode"
                className="w-full max-w-md h-auto"
              />
            </div>

            {/* Info and Start Button */}
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <p className="text-2xl font-semibold text-muted-foreground">
                  Aktive Leihvorgänge:
                </p>
                <p className="text-6xl font-bold text-primary">
                  {activeRentals.length}
                </p>
              </div>

              {activeRentals.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-lg text-muted-foreground">
                    Keine aktiven Leihvorgänge gefunden. Alle Leihvorgänge sind abgeschlossen.
                  </p>
                  <Button
                    onClick={handleReturnToDashboard}
                    size="lg"
                    className="text-lg px-8 py-6"
                  >
                    Zurück zum Dashboard
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleStart}
                  size="lg"
                  className="text-2xl px-12 py-8 h-auto"
                >
                  START SYSTEM CHECK
                </Button>
              )}
            </div>
          </div>
        ) : state === 'running' && currentRental ? (
          // RUNNING STATE
          <div className="max-w-4xl mx-auto">
            {/* Progress */}
            <div className="text-center mb-8">
              <p className="text-lg text-muted-foreground mb-2">Fortschritt</p>
              <p className="text-4xl font-bold text-primary">{progress}</p>
            </div>

            {/* Current Rental Display */}
            <div className="border-2 border-primary rounded-lg p-8 bg-background shadow-lg">
              <div className="space-y-6">
                {/* Customer */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    KUNDE
                  </h3>
                  {currentRental.expand?.customer ? (
                    <div className="text-2xl font-bold">
                      <span className="font-mono text-primary mr-3">
                        #{String(currentRental.expand.customer.iid).padStart(4, '0')}
                      </span>
                      {currentRental.expand.customer.firstname}{' '}
                      {currentRental.expand.customer.lastname}
                    </div>
                  ) : (
                    <p className="text-xl text-muted-foreground">Kunde nicht gefunden</p>
                  )}
                </div>

                {/* Items */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    GEGENSTÄNDE
                  </h3>
                  <div className="space-y-2">
                    {currentRental.expand?.items?.length > 0 ? (
                      currentRental.expand.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 text-xl">
                          <span className="font-mono text-primary font-bold">
                            #{String(item.iid).padStart(4, '0')}
                          </span>
                          <span className="font-medium">{item.name}</span>
                          {item.brand && (
                            <span className="text-muted-foreground text-base">
                              ({item.brand})
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">Keine Gegenstände</p>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">
                      AUSGELIEHEN AM
                    </h3>
                    <p className="text-lg font-medium">
                      {formatDate(currentRental.rented_on)}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">
                      ERWARTET AM
                    </h3>
                    <p className="text-lg font-medium">
                      {formatDate(currentRental.expected_on)}
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    STATUS
                  </h3>
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {getRentalStatusLabel(
                      calculateRentalStatus(
                        currentRental.rented_on,
                        currentRental.returned_on,
                        currentRental.expected_on,
                        currentRental.extended_on
                      )
                    )}
                  </Badge>
                </div>

                {/* Deposit */}
                {currentRental.deposit > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">
                      PFAND
                    </h3>
                    <p className="text-lg font-medium">{currentRental.deposit} €</p>
                  </div>
                )}

                {/* Remark */}
                {currentRental.remark && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">
                      BEMERKUNG
                    </h3>
                    <p className="text-base">{currentRental.remark}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-6 mt-8">
              <Button
                onClick={handleReject}
                variant="destructive"
                size="lg"
                className="text-xl px-12 py-8 h-auto min-w-[200px]"
              >
                <XIcon className="size-8 mr-3" />
                REJECT
              </Button>
              <Button
                onClick={handleAccept}
                variant="default"
                size="lg"
                className="text-xl px-12 py-8 h-auto min-w-[200px] bg-green-600 hover:bg-green-700"
              >
                <CheckIcon className="size-8 mr-3" />
                ACCEPT
              </Button>
            </div>
          </div>
        ) : state === 'completed' ? (
          // COMPLETED STATE
          <div className="max-w-4xl mx-auto text-center">
            {/* ASCII Art Logo (smaller) */}
            <div className="flex justify-center mb-8">
              <img
                src="/SCM.svg"
                alt="System Check Mode"
                className="w-full max-w-sm h-auto opacity-60"
              />
            </div>

            {/* Congratulations */}
            <div className="space-y-6">
              <h2 className="text-5xl font-bold text-green-600">
                Herzlichen Glückwunsch!
              </h2>
              <p className="text-2xl text-muted-foreground">
                Sie haben alle {activeRentals.length} aktiven Leihvorgänge überprüft.
              </p>
              <p className="text-lg text-muted-foreground">
                System Check abgeschlossen.
              </p>

              {/* Action Buttons */}
              <div className="flex justify-center gap-4 mt-8">
                <Button
                  onClick={handleRestart}
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-6"
                >
                  Erneut prüfen
                </Button>
                <Button
                  onClick={handleReturnToDashboard}
                  size="lg"
                  className="text-lg px-8 py-6"
                >
                  Zurück zum Dashboard
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Rental Detail Sheet */}
      <RentalDetailSheet
        rental={selectedRental}
        open={isSheetOpen}
        onOpenChange={handleSheetClose}
        onSave={handleRentalSave}
      />
    </div>
  );
}
