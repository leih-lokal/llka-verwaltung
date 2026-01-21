/**
 * Empty state component for tables
 * Shows configuration prompt if settings collection doesn't exist
 */

'use client';

import Link from 'next/link';
import { Settings, Package, Users, Calendar, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/use-settings';

interface EmptyStateProps {
  /** Type of entity for contextual messaging */
  entity: 'customers' | 'items' | 'rentals' | 'reservations';
  /** Whether a search/filter is active */
  hasSearch?: boolean;
}

const ENTITY_CONFIG = {
  customers: {
    icon: Users,
    singular: 'Kund:in',
    plural: 'Kund:innen',
    noResults: 'Keine Kund:innen gefunden',
    noSearchResults: 'Keine Ergebnisse gefunden',
  },
  items: {
    icon: Package,
    singular: 'Gegenstand',
    plural: 'Gegenstände',
    noResults: 'Keine Gegenstände gefunden',
    noSearchResults: 'Keine Ergebnisse gefunden',
  },
  rentals: {
    icon: BookOpen,
    singular: 'Ausleihe',
    plural: 'Ausleihen',
    noResults: 'Keine Ausleihen gefunden',
    noSearchResults: 'Keine Ergebnisse gefunden',
  },
  reservations: {
    icon: Calendar,
    singular: 'Reservierung',
    plural: 'Reservierungen',
    noResults: 'Keine Reservierungen gefunden',
    noSearchResults: 'Keine Ergebnisse gefunden',
  },
};

export function EmptyState({ entity, hasSearch = false }: EmptyStateProps) {
  const { collectionExists, isLoading } = useSettings();
  const config = ENTITY_CONFIG[entity];
  const Icon = config.icon;

  // Don't show setup prompt while loading settings
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{config.noResults}</p>
      </div>
    );
  }

  // If settings collection doesn't exist, prompt to configure
  if (!collectionExists) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Settings className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Konfiguration erforderlich</h3>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Um {config.plural} zu verwalten, muss zuerst die Anwendung konfiguriert werden.
          Richte Branding, Farben und weitere Einstellungen ein.
        </p>
        <Button asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4 mr-2" />
            Zur Konfiguration
          </Link>
        </Button>
      </div>
    );
  }

  // Normal empty state
  if (hasSearch) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{config.noSearchResults}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Noch keine {config.plural}</h3>
      <p className="text-muted-foreground text-center max-w-md">
        Erstelle {config.singular === 'Ausleihe' || config.singular === 'Reservierung' ? 'eine' : 'einen'} neue{config.singular === 'Ausleihe' || config.singular === 'Reservierung' ? '' : 'n'} {config.singular}, um loszulegen.
      </p>
    </div>
  );
}
