/**
 * Ordering helpers for dashboard notes
 */

import type { Note } from '@/types';

/**
 * order_index for a new note: one past the highest existing index.
 * `notes.length` collides after deletions (indexes 0, 2 → length 2).
 */
export function nextNoteOrderIndex(notes: Pick<Note, 'order_index'>[]): number {
  const indexes = notes.map((n) => n.order_index).filter(Number.isFinite);
  return indexes.length > 0 ? Math.max(...indexes) + 1 : 0;
}
