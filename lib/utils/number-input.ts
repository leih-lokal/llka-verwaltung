/**
 * Helpers for numeric form inputs
 */

/**
 * Parse a number input's text and clamp it to [min, max], rounded to an
 * integer. Empty or unparseable text yields `fallback` (the last committed
 * value).
 */
export function clampNumberInput(
  raw: string,
  min: number,
  max: number,
  fallback: number
): number {
  const n = Number(raw.trim());
  if (raw.trim() === '' || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
