/**
 * Navigation link component with active state
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  href: string;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
}

export function NavLink({ href, icon: Icon, label, collapsed }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border',
        isActive
          ? 'border-primary bg-primary/90 text-white'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
        collapsed && 'justify-center'
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
