/**
 * Top navigation bar component
 */

'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Package,
  ClipboardList,
  Calendar,
  Settings,
  FileText,
  LogOut,
  MoreVertical,
  User,
  Command,
  ArrowBigUp as Shift,
  Option,
  Zap,
  Tag,
  ClipboardCheck,
  Layers,
  BarChart3,
  AlertCircle,
  Search,
  Keyboard,
  ArrowRight,
  Menu,
} from 'lucide-react';
import { NavLink } from './nav-link';
import { IdentityPicker } from './identity-picker';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { useAuth } from '@/hooks/use-auth';
import { useQuickFind } from '@/hooks/use-quick-find';
import { useSequentialMode } from '@/hooks/use-sequential-mode';
import { useCommandMenu } from '@/hooks/use-command-menu';
import { useKeyboardShortcutsReferenceContext } from '@/components/keyboard-shortcuts/keyboard-shortcuts-reference';

interface MenuTileProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  shortcut?: { keys: string[] };
  onClick?: () => void;
  href?: string;
}

function MenuTile({ icon, label, description, shortcut, onClick, href }: MenuTileProps) {
  const content = (
    <>
      {/* Icon */}
      <div className="text-primary group-hover:text-accent-foreground transition-colors mb-2">
        {icon}
      </div>

      {/* Label */}
      <div className="font-semibold text-sm mb-1 group-hover:text-accent-foreground transition-colors">
        {label}
      </div>

      {/* Description */}
      <div className="text-xs text-muted-foreground group-hover:text-accent-foreground/80 transition-colors mb-2 hyphens-auto">
        {description}
      </div>

      {/* Keyboard Shortcut */}
      {shortcut && (
        <div className="flex items-center gap-0.5 mt-auto">
          {shortcut.keys.map((key, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground/60 transition-colors" />}
              <kbd className="px-1.5 py-0.5 text-[12px] font-mono font-medium bg-muted group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground transition-colors rounded">
                {key}
              </kbd>
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group flex flex-col p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer h-full"
        role="menuitem"
        aria-label={`${label}: ${description}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className="group flex flex-col p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer text-left h-full w-full"
      role="menuitem"
      aria-label={`${label}: ${description}`}
    >
      {content}
    </button>
  );
}

const navigationItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
  },
  {
    href: '/customers',
    icon: Users,
    label: 'Nutzer:innen',
  },
  {
    href: '/items',
    icon: Package,
    label: 'Gegenstände',
  },
  {
    href: '/rentals',
    icon: ClipboardList,
    label: 'Leihvorgänge',
  },
  {
    href: '/reservations',
    icon: Calendar,
    label: 'Reservierungen',
  },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const { setOpen } = useQuickFind();
  const { setOpen: setSequentialModeOpen } = useSequentialMode();
  const { setOpen: setCommandMenuOpen } = useCommandMenu();
  const { setOpen: setKeyboardShortcutsOpen } = useKeyboardShortcutsReferenceContext();
  const userEmail = (user as any)?.email || 'admin@leihlokal.de';

  // State for current time
  const [currentTime, setCurrentTime] = useState(new Date());

  // Detect OS for keyboard shortcut display
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format time and date
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b-2 border-primary bg-background">
      <div className="flex h-full items-center px-4">
        {/* Logo */}
        <div
          onDoubleClick={() => setSequentialModeOpen(true)}
          className="flex items-center cursor-pointer"
          title="Doppelklick für Sequential Mode"
        >
          <Link href="/dashboard" className="flex items-center">
            <Image
              src="/smile.svg"
              alt="LeihLokal"
              width={40}
              height={40}
              className="h-10 w-10"
              unoptimized
              priority
            />
          </Link>
        </div>

        {/* Main Navigation */}
        <div className="ml-8 flex flex-1 items-center space-x-1">
          {navigationItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </div>

        {/* Time and Date */}
        <div className="flex flex-col items-end mr-4 text-sm">

          <div className="font-mono">
            {currentTime.toLocaleDateString('de-DE', { 
              day: '2-digit', 
              month: '2-digit', 
              year: '2-digit' 
            })}
          </div>
        </div>

        {/* Identity Picker */}
        <IdentityPicker />

        {/* Overflow Menu */}
        <div className="flex ml-2 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mehr Optionen">
                <Menu className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-[calc(100vw-2rem)] max-w-[520px] p-0"
              role="menu"
              aria-label="Navigations-Menü"
            >
              <div className="p-4 space-y-4">
                {/* Actions Category */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
                    Mehr Aktionen
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <MenuTile
                      icon={<Search className="h-4 w-4" />}
                      label="Suchen"
                      description="Suche nach Nutzer, Gegenstand, oder Leihvorgang."
                      shortcut={{ keys: ['O', 'S'] }}
                      onClick={() => setCommandMenuOpen(true)}
                    />
                    <MenuTile
                      icon={<Zap className="h-4 w-4" />}
                      label="Finden"
                      description="Finde eine ID-Nummer im System."
                      shortcut={{ keys: ['O', 'F'] }}
                      onClick={() => setOpen(true)}
                    />
                    <MenuTile
                      icon={<Layers className="h-4 w-4" />}
                      label="Eintragen"
                      description="Trage einen neuen Leihvorgang schnell ein."
                      shortcut={{ keys: ['O', 'O'] }}
                      onClick={() => setSequentialModeOpen(true)}
                    />
                  </div>
                </section>

                {/* Tools Category */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
                    Werkzeuge
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <MenuTile
                      icon={<AlertCircle className="h-4 w-4" />}
                      label="Überfällige Ausleihen"
                      description="Sieh dir schnell alle überfälligen Ausleihen an."
                      shortcut={{ keys: ['G', 'O'] }}
                      href="/overdue"
                    />
                    <MenuTile
                      icon={<BarChart3 className="h-4 w-4" />}
                      label="Inventaranalyse"
                      description="Sieh dir an, welche Gegenstände beliebt sind, und welche nicht genutzt werden."
                      shortcut={{ keys: ['G', 'I'] }}
                      href="/items/analytics"
                    />
                    <MenuTile
                      icon={<ClipboardCheck className="h-4 w-4" />}
                      label="Systemcheck"
                      description="Prüfe die Leihumschläge gegen die Informationen in der Datenbank."
                      shortcut={{ keys: ['G', 'S'] }}
                      href="/system-check"
                    />
                    <MenuTile
                      icon={<Tag className="h-4 w-4" />}
                      label="Label Designer"
                      description="Erstelle und drucke Etiketten für Gegenstände."
                      shortcut={{ keys: ['G', 'P'] }}
                      href="/label-designer"
                    />
                  </div>
                </section>

                {/* System Category */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
                    System
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <MenuTile
                      icon={<FileText className="h-4 w-4" />}
                      label="Logs"
                      description="Sieh dir alle Kommunikation mit dem Server an."
                      shortcut={{ keys: ['G', 'L'] }}
                      href="/logs"
                    />
                    <MenuTile
                      icon={<Keyboard className="h-4 w-4" />}
                      label="Tastaturkürzel"
                      description="Sieh eine Liste aller Kurzbefehle an."
                      shortcut={{ keys: ['/'] }}
                      onClick={() => setKeyboardShortcutsOpen(true)}
                    />
                    <MenuTile
                      icon={<LogOut className="h-4 w-4" />}
                      label="Trennen"
                      description="Trenne LLKA-V2 vom Server."
                      onClick={logout}
                    />
                  </div>
                </section>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </nav>
  );
}
