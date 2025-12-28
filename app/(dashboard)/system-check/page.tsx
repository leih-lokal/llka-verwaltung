/**
 * System Check Mode page
 * Allows workers to systematically verify active rentals against physical records
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeftIcon, CheckIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RentalDetailSheet } from '@/components/detail-sheets/rental-detail-sheet';
import { RentalQueueItem } from '@/components/system-check/rental-queue-item';
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
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // Fetch active rentals on mount
  useEffect(() => {
    fetchActiveRentals();
  }, []);

  // Update date/time every second
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentDate(now.toLocaleDateString('de-DE'));
      setCurrentTime(now.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }));
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);

    return () => clearInterval(interval);
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
          sort: '-customer.iid', // Sort by customer ID, newest first (descending)
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

  const getQueueItemStatus = (index: number): 'processed' | 'current' | 'pending' => {
    if (processedRentalIds.has(activeRentals[index]?.id)) {
      return 'processed';
    }
    if (index === currentIndex) {
      return 'current';
    }
    return 'pending';
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
    <div className="h-full flex flex-col relative overflow-hidden bg-black crt-allow-shadow">
      <div className="h-full flex flex-col crt-screen crt-scanlines">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(251, 146, 60, 0.03) 2px, rgba(251, 146, 60, 0.03) 4px)',
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255, 255, 255, 0.03) 2px, rgba(255, 255, 255, 0.03) 4px)',
        }} />
      </div>

      {/* Animated Corner Brackets */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-amber-500 opacity-60 animate-pulse" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-amber-500 opacity-60 animate-pulse" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-amber-500 opacity-60 animate-pulse" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-amber-500 opacity-60 animate-pulse" />

      {/* Content */}
      <div className="flex-1 overflow-auto p-8 relative z-10">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="relative">
              <div className="h-20 w-20 animate-spin border-4 border-amber-500 border-t-transparent rounded-full" />
              <div className="absolute inset-0 h-20 w-20 animate-ping border-4 border-amber-500 border-t-transparent rounded-full opacity-20" />
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="max-w-md text-center space-y-6 p-8 border-2 border-amber-500 bg-black rounded-lg shadow-[0_0_30px_rgba(251,146,60,0.5)]">
              <p className="text-amber-500 font-mono text-lg uppercase tracking-wider">System Error</p>
              <p className="text-white font-medium">{error}</p>
              <p className="text-sm text-white/60">
                Bitte überprüfen Sie Ihre PocketBase-Verbindung
              </p>
              <Button
                onClick={fetchActiveRentals}
                className="mt-4 bg-black hover:bg-amber-950 border-2 border-amber-500 text-amber-500 shadow-[0_0_20px_rgba(251,146,60,0.5)]"
              >
                Erneut versuchen
              </Button>
            </div>
          </div>
        ) : state === 'idle' ? (
          // IDLE STATE - TUI SIMPLE
          <div className="h-full flex flex-col items-center justify-center p-8 font-mono text-amber-500">
            {/* ASCII Logo */}
            <div className="mb-12 w-full max-w-3xl">
              <Image
                src="/SCM.svg"
                alt="System Check Mode"
                width={768}
                height={200}
                className="w-full opacity-90"
                unoptimized
                priority
              />
            </div>

            {/* Active Rentals Count */}
            <div className="mb-12 text-center">
              <div className="text-sm text-amber-700 mb-2 tracking-widest">ACTIVE RENTALS</div>
              <div className="text-8xl font-bold tabular-nums crt-text-glow">
                {activeRentals.length}
              </div>
            </div>

            {/* Start Button */}
            {activeRentals.length > 0 ? (
              <Button
                onClick={handleStart}
                className="border-2 border-amber-500 bg-black hover:bg-amber-950 text-amber-500 px-12 py-6 font-mono text-xl tracking-wider transition-all hover:scale-105"
              >
                [ START SYSTEM CHECK ]
              </Button>
            ) : (
              <Button
                onClick={handleReturnToDashboard}
                className="border-2 border-amber-700 bg-black hover:bg-amber-950/50 text-amber-700 px-12 py-6 font-mono text-lg tracking-wider transition-all hover:scale-105"
              >
                [ RETURN TO DASHBOARD ]
              </Button>
            )}
          </div>
        ) : state === 'running' && currentRental ? (
          // RUNNING STATE - TWO COLUMN LAYOUT
          <div className="flex flex-col lg:flex-row gap-6 h-full max-w-7xl mx-auto px-8">
            {/* LEFT COLUMN - Queue */}
            <div className="w-full lg:w-2/5 flex flex-col min-h-0">
              <div className="mb-4">
                <h2 className="text-xs font-mono uppercase tracking-[0.3em] text-white/60 mb-2">
                  &gt; Processing Queue
                </h2>
                <p className="text-3xl font-black tabular-nums text-amber-500 crt-text-glow">
                  {progress}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 crt-scrollbar pr-2">
                {activeRentals.map((rental, index) => (
                  <RentalQueueItem
                    key={rental.id}
                    rental={rental}
                    status={getQueueItemStatus(index)}
                    isCurrent={index === currentIndex}
                  />
                ))}
              </div>
            </div>

            {/* RIGHT COLUMN - Current Rental Details */}
            <div className="w-full lg:w-3/5 flex flex-col min-h-0 space-y-6">
              {/* Current Rental Display */}
              <div className="relative border-2 border-amber-500 rounded-lg p-8 bg-black shadow-[0_0_50px_rgba(251,146,60,0.3)] flex-1 overflow-y-auto crt-scrollbar crt-border-glow">
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-white" />
              <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-white" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-white" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-white" />

              <div className="space-y-6">
                {/* Customer */}
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/60 mb-3">
                    &gt; Nutzer
                  </h3>
                  {currentRental.expand?.customer ? (
                    <div className="text-2xl font-bold text-white">
                      <span className="font-mono text-amber-500 mr-3 text-3xl crt-text-glow">
                        #{String(currentRental.expand.customer.iid).padStart(4, '0')}
                      </span>
                      {currentRental.expand.customer.firstname}{' '}
                      {currentRental.expand.customer.lastname}
                    </div>
                  ) : (
                    <p className="text-xl text-amber-400">Nutzer nicht gefunden</p>
                  )}
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

                {/* Items */}
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/60 mb-3">
                    &gt; Gegenstände
                  </h3>
                  <div className="space-y-3">
                    {currentRental.expand?.items?.length > 0 ? (
                      currentRental.expand.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 text-lg border-l-2 border-amber-500 pl-4 py-2 bg-amber-950/20">
                          <span className="font-mono text-amber-400 font-bold text-xl crt-text-glow">
                            #{String(item.iid).padStart(4, '0')}
                          </span>
                          <span className="font-semibold text-white">{item.name}</span>
                          {item.brand && (
                            <span className="text-white/60 text-sm font-mono">
                              [{item.brand}]
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-white/50">Keine Gegenstände</p>
                    )}
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

                {/* Dates */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/60 mb-2">
                      &gt; Ausgeliehen
                    </h3>
                    <p className="text-lg font-semibold text-white font-mono">
                      {formatDate(currentRental.rented_on)}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/60 mb-2">
                      &gt; Erwartet
                    </h3>
                    <p className="text-lg font-semibold text-white font-mono">
                      {formatDate(currentRental.expected_on)}
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-6">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/60 mb-2">
                      &gt; Status
                    </h3>
                    <Badge className="text-sm px-3 py-1 bg-amber-500/20 text-white border-amber-500">
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
                      <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/60 mb-2">
                        &gt; Pfand
                      </h3>
                      <p className="text-lg font-bold text-green-400 font-mono">{currentRental.deposit} €</p>
                    </div>
                  )}
                </div>

                {/* Remark */}
                {currentRental.remark && (
                  <>
                    <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/60 mb-2">
                        &gt; Bemerkung
                      </h3>
                      <p className="text-base text-white border-l-2 border-yellow-500 pl-4 py-2 bg-yellow-950/10 font-mono">{currentRental.remark}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-8">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-amber-500 rounded-lg blur-md opacity-75 group-hover:opacity-100 transition duration-300" />
                  <Button
                    onClick={handleReject}
                    size="lg"
                    className="relative w-full sm:w-auto text-2xl px-12 py-8 h-auto sm:min-w-[220px] bg-black border-2 border-amber-500 text-amber-500 hover:bg-amber-950 font-black uppercase tracking-wider shadow-[0_0_30px_rgba(251,146,60,0.5)] transition-all hover:scale-105"
                  >
                    <XIcon className="size-8 mr-3" />
                    Reject
                  </Button>
                </div>
                <div className="relative group">
                  <div className="absolute -inset-1 bg-white rounded-lg blur-md opacity-75 group-hover:opacity-100 transition duration-300" />
                  <Button
                    onClick={handleAccept}
                    size="lg"
                    className="relative w-full sm:w-auto text-2xl px-12 py-8 h-auto sm:min-w-[220px] bg-black border-2 border-white text-white hover:bg-white/10 font-black uppercase tracking-wider shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all hover:scale-105"
                  >
                    <CheckIcon className="size-8 mr-3" />
                    Accept
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : state === 'completed' ? (
          // COMPLETED STATE
          <div className="flex items-center justify-center min-h-full">
            <div className="max-w-4xl text-center space-y-12">
              {/* Success Animation */}
              <div className="relative">
                <div className="absolute inset-0 bg-green-500 blur-[100px] opacity-30 animate-pulse" />
                <div className="relative">
                  <h2 className="text-5xl sm:text-6xl md:text-8xl font-black uppercase tracking-wider text-white animate-pulse crt-text-glow">
                    System Check
                  </h2>
                  <h2 className="text-5xl sm:text-6xl md:text-8xl font-black uppercase tracking-wider text-white crt-text-glow">
                    Complete
                  </h2>
                  <div className="absolute inset-0 text-6xl md:text-8xl font-black uppercase tracking-wider text-green-500 opacity-20 blur-md">
                    System Check<br />Complete
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 animate-pulse" />
                <div className="relative space-y-4 p-8 border-2 border-green-500 bg-black rounded-lg">
                  <div className="flex items-center justify-center gap-3">
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(34,197,94,1)]" />
                    <p className="text-sm font-mono uppercase tracking-[0.3em] text-white">
                      All Systems Verified
                    </p>
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(34,197,94,1)]" />
                  </div>
                  <p className="text-5xl font-black tabular-nums text-white">
                    {processedRentalIds.size}
                  </p>
                  <p className="text-base font-mono text-white/80">
                    Leihvorgänge überprüft
                  </p>
                  <div className="h-1 w-full bg-gradient-to-r from-transparent via-green-500 to-transparent" />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-lg text-white/70 font-mono uppercase tracking-wider">
                  Validierung erfolgreich abgeschlossen
                </p>
                <p className="text-sm text-white/50 font-mono">
                  Alle Datensätze synchronisiert
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-6 mt-8">
                <Button
                  onClick={handleRestart}
                  size="lg"
                  className="text-lg px-8 py-6 bg-black hover:bg-amber-950 border-2 border-amber-500 text-amber-500 shadow-[0_0_25px_rgba(251,146,60,0.4)] font-mono uppercase tracking-wider transition-all hover:scale-105"
                >
                  &lt;&lt; Erneut prüfen
                </Button>
                <Button
                  onClick={handleReturnToDashboard}
                  size="lg"
                  className="text-lg px-8 py-6 bg-black hover:bg-white/10 border-2 border-white text-white shadow-[0_0_25px_rgba(255,255,255,0.4)] font-mono uppercase tracking-wider transition-all hover:scale-105"
                >
                  &gt;&gt; Dashboard
                </Button>
              </div>

              {/* Success Indicators */}
              <div className="flex justify-center items-center gap-4 text-xs font-mono text-white/60 uppercase tracking-wider pt-8">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                  Validation: OK
                </span>
                <span>|</span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                  Integrity: OK
                </span>
                <span>|</span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                  Status: Complete
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
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
