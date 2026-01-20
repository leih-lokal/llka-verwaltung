/**
 * Navigation link component with active state
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  href: string;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
}

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(
  function NavLink({ href, icon: Icon, label, collapsed, disabled, disabledTitle }, ref) {
    const pathname = usePathname();
    const isActive = pathname === href || pathname.startsWith(`${href}/`);

    if (disabled) {
      return (
        <span
          className={cn(
            'flex items-center gap-2 px-4 py-2 font-medium transition-colors border cursor-not-allowed',
            'border-transparent text-muted-foreground/50 text-base',
            collapsed && 'justify-center'
          )}
          title={disabledTitle || `${label} ist deaktiviert`}
        >
          <Icon className="flex-shrink-0 h-4 w-4" />
          {!collapsed && <span>{label}</span>}
        </span>
      );
    }

    return (
      <Link
        ref={ref}
        href={href}
        className={cn(
          'flex items-center gap-2 px-4 py-2 font-medium transition-colors border',
          isActive
            ? 'border-primary bg-primary/90 text-white text-base'
            : 'border-transparent text-foreground/80 hover:text-foreground hover:bg-muted/50 text-base',
          collapsed && 'justify-center'
        )}
        title={collapsed ? label : undefined}
      >
        <Icon className={cn('flex-shrink-0', isActive ? 'h-4 w-4' : 'h-4 w-4')} />
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  }
);
