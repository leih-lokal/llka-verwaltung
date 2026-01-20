"use client"

import { useSettings } from "@/hooks/use-settings"
import { cn } from "@/lib/utils"

type IdSize = "sm" | "md" | "lg" | "xl"

interface FormattedIdProps {
  /** The numeric ID to display */
  id: number
  /** Size variant */
  size?: IdSize
  /** Additional class names */
  className?: string
  /** Override the format from settings (for previews) */
  formatOverride?: string
  /** Override the padding from settings (for previews) */
  paddingOverride?: number
}

const sizeClasses: Record<IdSize, { container: string; shitBox: string; shitText: string; simple: string }> = {
  sm: {
    container: "text-xs",
    shitBox: "px-1 py-0.5 text-xs",
    shitText: "px-0.5 text-xs",
    simple: "text-xs",
  },
  md: {
    container: "text-sm",
    shitBox: "px-1.5 py-0.5 text-sm font-bold",
    shitText: "px-0.5 text-sm font-semibold",
    simple: "text-sm",
  },
  lg: {
    container: "text-base",
    shitBox: "px-2 py-1 text-base font-bold",
    shitText: "px-0.5 text-base font-semibold",
    simple: "text-base",
  },
  xl: {
    container: "text-3xl",
    shitBox: "px-2.5 py-1 text-3xl font-bold",
    shitText: "px-0.5 text-3xl font-bold",
    simple: "text-3xl font-bold",
  },
}

/**
 * Renders a formatted ID based on settings.
 * Supports SH.IT notation (shelf-item with red/white boxes) or simple prefix formats.
 */
export function FormattedId({
  id,
  size = "lg",
  className,
  formatOverride,
  paddingOverride,
}: FormattedIdProps) {
  const { settings } = useSettings()

  const format = formatOverride ?? settings.id_format
  const padding = paddingOverride ?? settings.id_padding
  const sizes = sizeClasses[size]

  // SH.IT notation: split into two boxes (red + white)
  if (format === "shit") {
    const paddedId = String(id).padStart(4, "0")
    const firstHalf = paddedId.substring(0, 2)
    const secondHalf = paddedId.substring(2, 4)

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 border-2 border-border rounded-md pr-1.5 font-mono",
          sizes.container,
          className
        )}
      >
        <span
          className={cn(
            "inline-flex items-center justify-center bg-primary text-white rounded",
            sizes.shitBox
          )}
        >
          {firstHalf}
        </span>
        <span className={cn("text-foreground", sizes.shitText)}>
          {secondHalf}
        </span>
      </span>
    )
  }

  // Simple format: prefix + padded number
  const paddedId = padding > 0 ? String(id).padStart(padding, "0") : String(id)

  return (
    <span className={cn("font-mono", sizes.simple, className)}>
      {format}{paddedId}
    </span>
  )
}

/**
 * Static version for use outside SettingsProvider (e.g., server components, exports)
 * Uses provided format/padding instead of settings context
 */
export function FormattedIdStatic({
  id,
  format,
  padding,
  size = "lg",
  className,
}: {
  id: number
  format: string
  padding: number
  size?: IdSize
  className?: string
}) {
  const sizes = sizeClasses[size]

  // SH.IT notation
  if (format === "shit") {
    const paddedId = String(id).padStart(4, "0")
    const firstHalf = paddedId.substring(0, 2)
    const secondHalf = paddedId.substring(2, 4)

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 border-2 border-border rounded-md pr-1.5 font-mono",
          sizes.container,
          className
        )}
      >
        <span
          className={cn(
            "inline-flex items-center justify-center bg-primary text-white rounded",
            sizes.shitBox
          )}
        >
          {firstHalf}
        </span>
        <span className={cn("text-foreground", sizes.shitText)}>
          {secondHalf}
        </span>
      </span>
    )
  }

  // Simple format
  const paddedId = padding > 0 ? String(id).padStart(padding, "0") : String(id)

  return (
    <span className={cn("font-mono", sizes.simple, className)}>
      {format}{paddedId}
    </span>
  )
}
