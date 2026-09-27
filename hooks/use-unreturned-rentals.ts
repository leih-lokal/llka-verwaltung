/**
 * Live list of unreturned rentals (with customer and items expanded) for the
 * dashboard widgets. Loads once, then follows realtime rental events; loads
 * again after a realtime pause or reconnect.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { collections } from '@/lib/pocketbase/client';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import { removeRental, upsertUnreturnedRental } from '@/lib/utils/unreturned-rentals';
import type { Rental, RentalExpanded } from '@/types';

interface UseUnreturnedRentalsReturn {
  /** Unreturned rentals, ordered by expected_on */
  rentals: RentalExpanded[];
  /** True until the initial load has finished */
  loading: boolean;
}

export function useUnreturnedRentals(): UseUnreturnedRentalsReturn {
  const [rentals, setRentals] = useState<RentalExpanded[]>([]);
  const [loading, setLoading] = useState(true);

  // Latest event number per rental id. A getOne that resolves after a newer
  // event for the same rental is discarded, so a slow fetch can't bring back
  // a rental that was returned or deleted in the meantime.
  const eventSeqRef = useRef(new Map<string, number>());
  const nextSeq = useCallback((id: string) => {
    const seq = (eventSeqRef.current.get(id) ?? 0) + 1;
    eventSeqRef.current.set(id, seq);
    return seq;
  }, []);

  // Id of the latest load; a superseded load's response is dropped
  const loadIdRef = useRef(0);

  // (Re)load the whole list. Rentals that got a realtime event while the
  // request ran keep what the event handlers made of them, as the response
  // may predate that event.
  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    const seqAtStart = new Map(eventSeqRef.current);
    try {
      const result = await collections.rentals().getFullList<RentalExpanded>({
        expand: 'customer,items',
        filter: 'returned_on = ""',
        sort: 'expected_on',
      });
      if (loadId !== loadIdRef.current) return;
      const changed = new Set<string>();
      eventSeqRef.current.forEach((seq, id) => {
        if (seqAtStart.get(id) !== seq) changed.add(id);
      });
      setRentals((prev) =>
        prev
          .filter((r) => changed.has(r.id))
          .reduce(upsertUnreturnedRental, result.filter((r) => !changed.has(r.id)))
      );
    } catch (error) {
      if (loadId !== loadIdRef.current) return;
      console.error('Failed to load rentals:', error);
      toast.error('Fehler beim Laden der Ausleihen');
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Drop the response if unmounted meanwhile
    return () => {
      loadIdRef.current += 1;
    };
  }, [load]);

  const fetchAndUpsert = async (id: string) => {
    const seq = nextSeq(id);
    try {
      const expanded = await collections
        .rentals()
        .getOne<RentalExpanded>(id, { expand: 'customer,items' });
      if (eventSeqRef.current.get(id) !== seq) return;
      setRentals((prev) => upsertUnreturnedRental(prev, expanded));
    } catch (err) {
      console.error('Error fetching expanded rental:', err);
    }
  };

  const drop = (id: string) => {
    nextSeq(id);
    setRentals((prev) => removeRental(prev, id));
  };

  // Same rules for every event: upsert while unreturned, drop once returned
  useRealtimeSubscription<Rental>('rental', {
    onCreated: (rental) => {
      if (!rental.returned_on) fetchAndUpsert(rental.id);
    },
    onUpdated: (rental) => {
      if (rental.returned_on) drop(rental.id);
      else fetchAndUpsert(rental.id);
    },
    onDeleted: (rental) => drop(rental.id),
    // Changes missed while paused or disconnected
    onResubscribe: () => load(),
  });

  return { rentals, loading };
}
