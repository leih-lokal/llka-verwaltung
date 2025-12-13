/**
 * Navigation indicator group with sliding animation
 */

'use client';

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import { NavLink } from './nav-link';
import { cn } from '@/lib/utils';

interface NavigationItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

interface NavIndicatorGroupProps {
  items: NavigationItem[];
}

export function NavIndicatorGroup({ items }: NavIndicatorGroupProps) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Calculate active index based on current pathname
  const activeIndex = useMemo(() => {
    return items.findIndex(
      item => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
  }, [pathname, items]);

  // Update indicator position to match active navigation item
  const updateIndicatorPosition = useCallback(() => {
    if (activeIndex === -1) return;

    const activeElement = navRefs.current[activeIndex];
    const indicator = indicatorRef.current;
    const container = containerRef.current;

    if (!activeElement || !indicator || !container) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeElement.getBoundingClientRect();

    const left = activeRect.left - containerRect.left;
    const width = activeRect.width;

    indicator.style.transform = `translateX(${left}px)`;
    indicator.style.width = `${width}px`;

    // Fade in after initial position is set
    if (!isInitialized) {
      setTimeout(() => setIsInitialized(true), 50);
    }
  }, [activeIndex, isInitialized]);

  // Update position on mount and when active index changes
  useEffect(() => {
    updateIndicatorPosition();
  }, [updateIndicatorPosition, activeIndex]);

  // Handle window resize
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      updateIndicatorPosition();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [updateIndicatorPosition]);

  return (
    <div ref={containerRef} className="relative flex items-center space-x-1">
      {/* Navigation links */}
      {items.map((item, index) => (
        <NavLink
          key={item.href}
          ref={(el) => { navRefs.current[index] = el; }}
          href={item.href}
          icon={item.icon}
          label={item.label}
        />
      ))}

      {/* Sliding indicator */}
      {activeIndex !== -1 && (
        <div
          ref={indicatorRef}
          className={cn(
            "nav-sliding-indicator",
            !isInitialized && "initial"
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
