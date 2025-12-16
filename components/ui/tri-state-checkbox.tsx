"use client"

import * as React from "react"
import { CheckIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface TriStateCheckboxProps {
  state: 'unchecked' | 'checked' | 'excluded';
  onStateChange: (newState: 'unchecked' | 'checked' | 'excluded') => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Tri-state checkbox component
 * Cycles through: unchecked → checked (tick) → excluded (minus) → unchecked
 */
export function TriStateCheckbox({
  state,
  onStateChange,
  id,
  disabled,
  className
}: TriStateCheckboxProps) {
  const handleClick = () => {
    if (disabled) return;

    // Cycle through states: unchecked → checked → excluded → unchecked
    const nextState =
      state === 'unchecked' ? 'checked' :
      state === 'checked' ? 'excluded' :
      'unchecked';

    onStateChange(nextState);
  };

  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={
        state === 'checked' ? 'true' :
        state === 'excluded' ? 'mixed' :
        'false'
      }
      onClick={handleClick}
      disabled={disabled}
      data-state={state}
      className={cn(
        "peer border-input size-4 shrink-0 rounded-[4px] border shadow-xs",
        "transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        state === 'checked' && "bg-primary text-primary-foreground border-primary",
        state === 'excluded' && "bg-destructive text-destructive-foreground border-destructive",
        state === 'unchecked' && "bg-background",
        className
      )}
    >
      <span className="grid place-content-center text-current transition-none">
        {state === 'checked' && <CheckIcon className="size-3.5" />}
        {state === 'excluded' && <MinusIcon className="size-3.5" />}
      </span>
    </button>
  );
}
