import { describe, it, expect } from 'vitest';
import { nextNoteOrderIndex } from '../note-order';

describe('nextNoteOrderIndex', () => {
  it('starts at 0 for no notes', () => {
    expect(nextNoteOrderIndex([])).toBe(0);
  });

  it('goes past the highest index, not the count, after deletions', () => {
    expect(nextNoteOrderIndex([{ order_index: 0 }, { order_index: 2 }])).toBe(3);
  });

  it('ignores missing indexes', () => {
    expect(
      nextNoteOrderIndex([{ order_index: 4 }, { order_index: null as unknown as number }])
    ).toBe(5);
  });
});
