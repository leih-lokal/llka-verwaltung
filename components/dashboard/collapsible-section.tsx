/**
 * Collapsible Section Wrapper
 * Reusable wrapper that adds collapse functionality to dashboard sections
 */
'use client';

import { useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CollapsibleSectionProps {
  children: React.ReactNode;
  title: React.ReactNode;
  titleIcon?: React.ReactNode;
  headerActions?: React.ReactNode;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

/**
 * Wraps content in a collapsible Card component with smooth animation
 */
export function CollapsibleSection({
  children,
  title,
  titleIcon,
  headerActions,
  isCollapsed,
  onToggleCollapse,
  className,
}: CollapsibleSectionProps) {
  const contentId = useId();
  const toggleAction = isCollapsed ? 'ausklappen' : 'einklappen';
  const toggleLabel =
    typeof title === 'string' ? `${title} ${toggleAction}` : isCollapsed ? 'Ausklappen' : 'Einklappen';

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {titleIcon}
            <span>{title}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {headerActions}
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleCollapse}
              className="h-8 w-8 p-0"
              title={isCollapsed ? 'Ausklappen' : 'Einklappen'}
              aria-label={toggleLabel}
              aria-expanded={!isCollapsed}
              aria-controls={contentId}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      {/* inert keeps collapsed content out of the tab order and the
          accessibility tree while max-h-0 still animates the collapse */}
      <div
        id={contentId}
        inert={isCollapsed}
        className={cn(
          'transition-all duration-200 ease-in-out overflow-hidden',
          isCollapsed ? 'max-h-0' : 'max-h-[5000px]'
        )}
      >
        <CardContent>{children}</CardContent>
      </div>
    </Card>
  );
}
