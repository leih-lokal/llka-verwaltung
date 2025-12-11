/**
 * Rental Queue Item Component
 * Displays a compact rental card in the System Check Mode queue
 */
'use client';

import { CheckIcon, ChevronRightIcon, SquareIcon } from 'lucide-react';
import type { RentalExpanded } from '@/types';

interface RentalQueueItemProps {
  rental: RentalExpanded;
  status: 'processed' | 'current' | 'pending';
  isCurrent: boolean;
}

export function RentalQueueItem({ rental, status, isCurrent }: RentalQueueItemProps) {
  const customer = rental.expand?.customer;
  const itemCount = rental.expand?.items?.length || 0;

  // Status icon based on state
  const StatusIcon = status === 'processed' ? CheckIcon : status === 'current' ? ChevronRightIcon : SquareIcon;

  // Conditional styling based on status
  const containerClasses = `
    relative p-3 border-2 transition-all
    ${status === 'processed' ? 'border-amber-800 bg-amber-950/20 opacity-60' : ''}
    ${status === 'current' ? 'border-amber-500 bg-amber-950/40 crt-pulse-glow' : ''}
    ${status === 'pending' ? 'border-amber-700/50 bg-black/50' : ''}
  `;

  const textClasses = `
    ${status === 'processed' ? 'text-amber-800' : ''}
    ${status === 'current' ? 'text-amber-500 crt-text-glow' : ''}
    ${status === 'pending' ? 'text-amber-700' : ''}
  `;

  const iconClasses = `
    size-4 flex-shrink-0
    ${status === 'processed' ? 'text-amber-800' : ''}
    ${status === 'current' ? 'text-amber-500' : ''}
    ${status === 'pending' ? 'text-amber-700' : ''}
  `;

  return (
    <div className={containerClasses}>
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <StatusIcon className={iconClasses} />

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Customer ID and Name */}
          {customer ? (
            <div className="flex items-baseline gap-2">
              <span className={`font-mono text-sm font-bold ${textClasses}`}>
                #{String(customer.iid).padStart(4, '0')}
              </span>
              <span className={`text-sm font-semibold truncate ${status === 'current' ? 'text-white' : 'text-white/80'}`}>
                {customer.firstname} {customer.lastname}
              </span>
            </div>
          ) : (
            <p className="text-sm text-amber-400">Nutzer nicht gefunden</p>
          )}

          {/* Item Count */}
          <p className={`text-xs font-mono ${status === 'current' ? 'text-white/70' : 'text-white/50'}`}>
            {itemCount} {itemCount === 1 ? 'Gegenstand' : 'Gegenstände'}
          </p>
        </div>
      </div>

      {/* Corner accents for current item */}
      {status === 'current' && (
        <>
          <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 border-white" />
          <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 border-white" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 border-white" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 border-white" />
        </>
      )}
    </div>
  );
}
