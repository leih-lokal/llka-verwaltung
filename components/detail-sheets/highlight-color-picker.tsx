/**
 * Highlight colour picker for the customer and item sheets
 * A radio group of swatches with German names and arrow-key navigation. The
 * selected swatch carries a check mark, so the selection doesn't rely on
 * colour alone.
 */

'use client';

import type { ReactNode } from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_CLASSES,
  HIGHLIGHT_COLOR_LABELS,
} from '@/lib/constants/colors';
import { HighlightColor } from '@/types';

/** Highlight colour value as stored in the forms ('' = none) */
export type HighlightColorValue = `${HighlightColor}` | '';

// Radix radio items need a non-empty value
const NONE = 'none';

const SWATCH_BASE =
  'relative rounded-md border-2 transition-all flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

interface HighlightColorPickerProps {
  /** Selected colour ('' or undefined = none) */
  value: HighlightColorValue | undefined;
  /** Called with the newly selected colour ('' = none) */
  onChange: (value: HighlightColorValue) => void;
  /** id of the visible label of the group */
  labelledBy: string;
  /** Size classes for each swatch, e.g. "w-10 h-10" */
  swatchClassName: string;
  /** Extra classes for the group */
  className?: string;
  /** Optional content per colour, e.g. an icon */
  icons?: Partial<Record<HighlightColor, ReactNode>>;
}

export function HighlightColorPicker({
  value,
  onChange,
  labelledBy,
  swatchClassName,
  className,
  icons,
}: HighlightColorPickerProps) {
  const current = value || NONE;

  return (
    <RadioGroupPrimitive.Root
      value={current}
      onValueChange={(next) => onChange(next === NONE ? '' : (next as HighlightColorValue))}
      aria-labelledby={labelledBy}
      className={cn('flex gap-2', className)}
    >
      <RadioGroupPrimitive.Item
        value={NONE}
        aria-label="Keine Markierung"
        title="Keine Markierung"
        className={cn(
          SWATCH_BASE,
          swatchClassName,
          'bg-muted hover:bg-muted/80',
          current === NONE
            ? 'border-primary ring-2 ring-primary/20 scale-105'
            : 'border-border hover:border-primary/50'
        )}
      >
        <span aria-hidden="true" className="text-xs text-muted-foreground font-medium">—</span>
        <SelectedMark />
      </RadioGroupPrimitive.Item>
      {HIGHLIGHT_COLORS.map((color) => (
        <RadioGroupPrimitive.Item
          key={color}
          value={color}
          aria-label={HIGHLIGHT_COLOR_LABELS[color]}
          title={HIGHLIGHT_COLOR_LABELS[color]}
          className={cn(
            SWATCH_BASE,
            swatchClassName,
            HIGHLIGHT_COLOR_CLASSES[color].swatch,
            current === color
              ? HIGHLIGHT_COLOR_CLASSES[color].swatchChecked
              : HIGHLIGHT_COLOR_CLASSES[color].swatchUnchecked
          )}
        >
          {icons?.[color]}
          <SelectedMark />
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

/** Check mark badge, rendered by Radix only on the selected swatch */
function SelectedMark() {
  return (
    <RadioGroupPrimitive.Indicator className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-foreground text-background">
      <CheckIcon className="size-3" strokeWidth={3} aria-hidden="true" />
    </RadioGroupPrimitive.Indicator>
  );
}
