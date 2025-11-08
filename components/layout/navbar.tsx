/**
 * Top navigation bar component
 */

'use client';

import { useState, useEffect } from 'react';
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
  Zap,
  Tag,
} from 'lucide-react';
import { NavLink } from './nav-link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { useQuickFind } from '@/hooks/use-quick-find';

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
          <div className="font-mono font-semibold text-foreground">
            {formatTime(currentTime)}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDate(currentTime)}
          </div>
        </div>

        {/* Quick Find Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="mr-2 h-7 px-2 gap-1.5 hover:bg-accent transition-colors"
          title="Quick Find (Cmd+P)"
        >
          <Zap className="h-3 w-3" />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-medium bg-muted border border-border rounded">
            <Command className="h-2 w-2" />
            <span>P</span>
          </kbd>
        </Button>

        {/* Overflow Menu */}
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mehr</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/label-designer" className="flex items-center cursor-pointer">
                  <Tag className="mr-2 h-4 w-4" />
                  <span>Label Designer</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/logs" className="flex items-center cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Logs</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Einstellungen</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {userEmail}
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Abmelden</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
