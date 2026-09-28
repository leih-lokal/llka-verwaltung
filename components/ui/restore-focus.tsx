"use client"

import * as React from "react"

/**
 * Focus return for Radix dialogs/sheets that are opened from state.
 *
 * Radix only returns focus to a Dialog.Trigger on close. Our dialogs and
 * detail sheets are opened programmatically (row clicks, shortcuts, other
 * dialogs), so there is no trigger and focus used to drop to <body>,
 * losing the keyboard user's place. This remembers what was focused when
 * the content mounted and puts focus back there on close.
 *
 * Usage: pass `onCloseAutoFocus` to the Radix Content (it wraps the
 * caller's handler, which runs first and can still preventDefault), and
 * render `<FocusReturnCapture onCapture={capture} />` as the FIRST child of
 * the Content.
 */
export function useRestoreFocus(onCloseAutoFocus?: (event: Event) => void) {
  const previousFocusRef = React.useRef<HTMLElement | null>(null)

  const capture = React.useCallback((element: HTMLElement | null) => {
    previousFocusRef.current = element
  }, [])

  const handleCloseAutoFocus = React.useCallback(
    (event: Event) => {
      onCloseAutoFocus?.(event)

      const previous = previousFocusRef.current
      previousFocusRef.current = null
      if (event.defaultPrevented || !previous || !previous.isConnected) return

      // Focus already moved somewhere meaningful (e.g. another dialog opened
      // as this one closed): don't steal it back.
      const active = document.activeElement
      if (active && active !== document.body) return

      // Prevents Radix's default (focusing the trigger, of which there is none).
      event.preventDefault()
      previous.focus()
    },
    [onCloseAutoFocus]
  )

  return { capture, onCloseAutoFocus: handleCloseAutoFocus }
}

/**
 * Records `document.activeElement` when it mounts.
 *
 * It must be the first child of the Radix Content: layout effects run in
 * tree order before React applies a later sibling's `autoFocus` and before
 * Radix's FocusScope (a passive effect) moves focus into the content, so
 * this still sees the element that was focused before opening.
 */
export function FocusReturnCapture({
  onCapture,
}: {
  onCapture: (element: HTMLElement | null) => void
}) {
  React.useLayoutEffect(() => {
    const active = document.activeElement
    onCapture(
      active instanceof HTMLElement && active !== document.body ? active : null
    )
  }, [onCapture])

  return null
}
