// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { pb } from '@/lib/pocketbase/client';
import { useFilters } from '../use-filters';

describe('useFilters buildFilter', () => {
  it('inserts the escaped search condition verbatim', () => {
    const { result } = renderHook(() =>
      useFilters({ entity: 'customers', config: { searchFields: ['firstname'] }, persist: false })
    );

    // With a string replacement, `$&` would re-insert the raw placeholder
    // (`__SEARCH__:"x' $& y"`) including its unescaped quote.
    const term = "x' $& y";
    const filter = result.current.buildFilter(term);
    expect(filter).toBe(`(${pb.filter('firstname ~ {:q}', { q: term })})`);
    expect(filter).not.toContain('__SEARCH__');
  });
});
