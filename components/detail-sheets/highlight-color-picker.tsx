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
import { HIGHLIGHT_COLOR_LABELS } from '@/lib/constants/colors';
import { HighlightColor } from '@/types';

/** Highlight colour value as stored in the forms ('' = none) */
export type HighlightColorValue = `${HighlightColor}` | '';

// Radix radio items need a non-empty value
const NONE = 'none';

// Swatches in display order. Class names are spelled out so Tailwind sees them.
const SWATCHES: {
  color: HighlightColor;
  background: string;
  checked: string;
  unchecked: string;
}[] = [
  {
    color: HighlightColor.Red,
    background: 'bg-red-100 dark:bg-red-950/30',
    checked: 'border-red-500 ring-2 ring-red-500/20 scale-105',
    unchecked: 'border-red-300 dark:border-red-800 hover:border-red-500',
  },
  {
    color: HighlightColor.Orange,
    background: 'bg-orange-100 dark:bg-orange-950/30',
    checked: 'border-orange-500 ring-2 ring-orange-500/20 scale-105',
    unchecked: 'border-orange-300 dark:border-orange-800 hover:border-orange-500',
  },
  {
    color: HighlightColor.Yellow,
    background: 'bg-yellow-100 dark:bg-yellow-950/30',
    checked: 'border-yellow-500 ring-2 ring-yellow-500/20 scale-105',
    unchecked: 'border-yellow-300 dark:border-yellow-800 hover:border-yellow-500',
  },
  {
    color: HighlightColor.Green,
    background: 'bg-green-100 dark:bg-green-950/30',
    checked: 'border-green-500 ring-2 ring-green-500/20 scale-105',
    unchecked: 'border-green-300 dark:border-green-800 hover:border-green-500',
  },
  {
    color: HighlightColor.Teal,
    background: 'bg-teal-100 dark:bg-teal-950/30',
    checked: 'border-teal-500 ring-2 ring-teal-500/20 scale-105',
    unchecked: 'border-teal-300 dark:border-teal-800 hover:border-teal-500',
  },
  {
    color: HighlightColor.Blue,
    background: 'bg-blue-100 dark:bg-blue-950/30',
    checked: 'border-blue-500 ring-2 ring-blue-500/20 scale-105',
    unchecked: 'border-blue-300 dark:border-blue-800 hover:border-blue-500',
  },
  {
    color: HighlightColor.Purple,
    background: 'bg-purple-100 dark:bg-purple-950/30',
    checked: 'border-purple-500 ring-2 ring-purple-500/20 scale-105',
    unchecked: 'border-purple-300 dark:border-purple-800 hover:border-purple-500',
  },
  {
    color: HighlightColor.Pink,
    background: 'bg-pink-100 dark:bg-pink-950/30',
    checked: 'border-pink-500 ring-2 ring-pink-500/20 scale-105',
    unchecked: 'border-pink-300 dark:border-pink-800 hover:border-pink-500',
  },
];

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
      {SWATCHES.map(({ color, background, checked, unchecked }) => (
        <RadioGroupPrimitive.Item
          key={color}
          value={color}
          aria-label={HIGHLIGHT_COLOR_LABELS[color]}
          title={HIGHLIGHT_COLOR_LABELS[color]}
          className={cn(
            SWATCH_BASE,
            swatchClassName,
            background,
            current === color ? checked : unchecked
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
