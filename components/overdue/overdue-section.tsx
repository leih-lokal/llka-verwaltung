/**
 * Overdue Section
 * Collapsible section for a severity level of overdue rentals
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import type { RentalExpanded } from '@/types';
import type { OverdueSeverity } from '@/lib/utils/overdue';
import { OverdueRentalCard } from './overdue-rental-card';

interface OverdueSectionProps {
  title: string;
  description: string;
  rentals: RentalExpanded[];
  variant: OverdueSeverity;
  onRentalUpdated: () => void;
}

const variantStyles: Record<OverdueSeverity, { bg: string; border: string; badge: string }> = {
  severely_critical: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-300 dark:border-red-800',
    badge: 'bg-red-600',
  },
  critical: {
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    border: 'border-orange-300 dark:border-orange-800',
    badge: 'bg-orange-600',
  },
  overdue: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/20',
    border: 'border-yellow-300 dark:border-yellow-800',
    badge: 'bg-yellow-600',
  },
  due_today: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-300 dark:border-blue-800',
    badge: 'bg-blue-600',
  },
  due_soon: {
    bg: 'bg-gray-50 dark:bg-gray-950/20',
    border: 'border-gray-300 dark:border-gray-800',
    badge: 'bg-gray-600',
  },
};

export function OverdueSection({
  title,
  description,
  rentals,
  variant,
  onRentalUpdated,
}: OverdueSectionProps) {
  const [isExpanded, setIsExpanded] = useState(rentals.length > 0);

  const styles = variantStyles[variant];

  // If no rentals, don't render
  if (rentals.length === 0) {
    return null;
  }

  return (
    <Card className={`${styles.border} border-2`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl">{title}</CardTitle>
            <Badge className={`${styles.badge} text-white`}>
              {rentals.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </Button>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <div className="space-y-3">
            {rentals.map((rental) => (
              <OverdueRentalCard
                key={rental.id}
                rental={rental}
                variant={variant}
                onUpdated={onRentalUpdated}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
