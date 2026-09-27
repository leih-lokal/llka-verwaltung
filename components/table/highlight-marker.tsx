/**
 * Highlight colour marker for list rows (customers, items): a coloured dot,
 * or a heart for green. The colour is also given as text (tooltip and
 * screen-reader text), so it isn't conveyed by colour alone.
 */

import { HeartIcon } from 'lucide-react';
import { HIGHLIGHT_COLOR_LABELS, getHighlightColorClasses } from '@/lib/constants/colors';
import { cn } from '@/lib/utils';
import { HighlightColor } from '@/types';

export interface HighlightMarkerProps {
  color?: HighlightColor | '';

  /** What a colour means in this list (CUSTOMER_/ITEM_HIGHLIGHT_MEANINGS) */
  meanings?: Partial<Record<HighlightColor, string>>;
}

export function HighlightMarker({ color, meanings }: HighlightMarkerProps) {
  if (!color) return null;

  const meaning = meanings?.[color];
  const label = `Markierung: ${HIGHLIGHT_COLOR_LABELS[color] ?? color}${meaning ? ` – ${meaning}` : ''}`;

  return (
    <span title={label} className="inline-flex shrink-0">
      {color === HighlightColor.Green ? (
        <HeartIcon className="size-4 fill-green-500 text-green-500 shrink-0" />
      ) : (
        <span
          aria-hidden="true"
          className={cn('size-3 rounded-full shrink-0', getHighlightColorClasses(color)?.solid ?? 'bg-blue-500')}
        />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}
