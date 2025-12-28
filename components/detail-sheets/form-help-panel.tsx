/**
 * Generic help panel for detail sheet forms
 * Displays static help content in the sheet overlay area
 */

'use client';

import { HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FormHelpPanelProps {
  /** The markdown content to display */
  content: string;
  /** Whether the panel is collapsed */
  isCollapsed: boolean;
  /** Callback when collapse state changes */
  onToggle: () => void;
  /** Optional title override */
  title?: string;
}

/**
 * Help panel component for detail sheet edit mode
 * Renders in the overlay/backdrop area to the left of the sheet
 */
export function FormHelpPanel({
  content,
  isCollapsed,
  onToggle,
  title = 'Hilfe zum Bearbeiten',
}: FormHelpPanelProps) {
  if (isCollapsed) {
    // Collapsed state - just show a thin strip with expand button
    return (
      <div
        className="hidden lg:flex flex-col items-center absolute my-20 left-0 top-0 bottom-0 w-12 bg-background/95 backdrop-blur-sm border-r animate-in slide-in-from-left duration-300"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label="Hilfe einblenden"
          className="mt-4"
        >
          <ChevronRight className="size-5" />
        </Button>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-muted-foreground [writing-mode:vertical-rl] rotate-180">
            Hilfe
          </span>
        </div>
      </div>
    );
  }

  // Expanded state - full panel
  return (
    <div
      className="hidden lg:flex flex-col absolute my-20 left-0 top-0 bottom-0 w-[calc(100vw-min(90vw,56rem)-10vw)] bg-background/95 backdrop-blur-sm border-r animate-in slide-in-from-left duration-300"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-5 text-muted-foreground" />
          <h3 className="font-semibold">{title}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label="Hilfe ausblenden"
          className="h-8 w-8"
        >
          <ChevronLeft className="size-4" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="markdown-prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
