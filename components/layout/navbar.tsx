/**
 * Top navigation bar component
 */

'use client';

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

const navigationItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
  },
  {
    href: '/customers',
    icon: Users,
    label: 'Kund:innen',
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
  const userEmail = (user as any)?.email || 'admin@leihlokal.de';

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
