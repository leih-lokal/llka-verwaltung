/**
 * Dashboard View Menu
 * Dropdown menu for toggling visibility of dashboard components
 */
'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, Calendar, ClipboardList, StickyNote, BarChart3, AlertCircle } from 'lucide-react';
import type { DashboardComponent } from '@/hooks/use-dashboard-preferences';

interface DashboardViewMenuProps {
  visibility: Record<DashboardComponent, boolean>;
  onToggleVisibility: (component: DashboardComponent) => void;
}

const COMPONENT_LABELS: Record<DashboardComponent, { label: string; icon: React.ReactNode }> = {
  'overdue-alert': {
    label: 'Überfällige Ausleihen',
    icon: <AlertCircle className="mr-2 h-4 w-4" />,
  },
  'due-this-week': {
    label: 'Fällig diese Woche',
    icon: <Calendar className="mr-2 h-4 w-4" />,
  },
  'today-activity': {
    label: 'Heutige Aktivität',
    icon: <BarChart3 className="mr-2 h-4 w-4" />,
  },
  'todays-reservations': {
    label: 'Heutige Reservierungen',
    icon: <Calendar className="mr-2 h-4 w-4" />,
  },
  'active-rentals': {
    label: 'Aktive Ausleihen',
    icon: <ClipboardList className="mr-2 h-4 w-4" />,
  },
  'dashboard-notes': {
    label: 'Notizen',
    icon: <StickyNote className="mr-2 h-4 w-4" />,
  },
  'stats-chart': {
    label: 'Statistiken',
    icon: <BarChart3 className="mr-2 h-4 w-4" />,
  },
};

/**
 * Dropdown menu for controlling which dashboard components are visible
 */
export function DashboardViewMenu({ visibility, onToggleVisibility }: DashboardViewMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="mr-2 h-4 w-4" />
          Ansicht
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Dashboard Komponenten</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(COMPONENT_LABELS) as DashboardComponent[]).map((component) => {
          const { label, icon } = COMPONENT_LABELS[component];
          return (
            <DropdownMenuCheckboxItem
              key={component}
              checked={visibility[component]}
              onCheckedChange={() => onToggleVisibility(component)}
            >
              {icon}
              {label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
