// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { pb } from '@/lib/pocketbase/client';
import {
  customersFilterConfig,
  rentalsFilterConfig,
  reservationsFilterConfig,
} from '@/lib/filters/filter-configs';
import { useFilters } from '../use-filters';

const configs = {
  customers: customersFilterConfig,
  rentals: rentalsFilterConfig,
  reservations: reservationsFilterConfig,
};

function buildSearch(entity: keyof typeof configs, term: string): string {
  const { result } = renderHook(() =>
    useFilters({ entity, config: configs[entity], persist: false })
  );
  return result.current.buildFilter(term);
}

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

describe('useFilters search', () => {
  it('does not lowercase the term', () => {
    const filter = buildSearch('customers', 'Öztürk');
    expect(filter).toContain("firstname ~ 'Öztürk'");
    expect(filter).not.toContain('öztürk');
  });

  it('uses any-of operators on multi-relation paths only', () => {
    const filter = buildSearch('rentals', 'bohr');
    expect(filter).toContain("items.name ?~ 'bohr'");
    expect(filter).toContain("customer.firstname ~ 'bohr'");
    expect(filter).not.toContain('customer.firstname ?~');
  });

  it('matches numeric terms against iids', () => {
    const filter = buildSearch('rentals', '0042');
    expect(filter).toContain('customer.iid = 42');
    expect(filter).toContain('items.iid ?= 42');
  });

  it('turns wildcard iids into ranges', () => {
    expect(buildSearch('customers', '37**')).toContain('(iid >= 3700 && iid <= 3799)');

    const filter = buildSearch('rentals', '3***');
    expect(filter).toContain('(customer.iid >= 3000 && customer.iid <= 3999)');
    expect(filter).toContain('(items.iid ?>= 3000 && items.iid ?<= 3999)');
    // The old fallback for large ranges searched the non-existent customer.name
    expect(filter).not.toContain('customer.name');
  });

  it('keeps wildcard filters short', () => {
    // Previously 200 `?=` terms (~4.4 KB)
    expect(buildSearch('rentals', '37**').length).toBeLessThan(400);
  });

  it('enumerates small ranges on multi-relations exactly', () => {
    const filter = buildSearch('reservations', '3*');
    const terms = Array.from({ length: 10 }, (_, i) => `items.iid ?= ${30 + i}`);
    expect(filter).toContain(`(${terms.join(' || ')})`);
  });
});

describe('useFilters persisted filters', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('migrates the reservations status filter to a boolean filter', () => {
    localStorage.setItem(
      'filters_reservations',
      JSON.stringify([
        { id: 'status-done-false', type: 'status', field: 'done', operator: '=', value: 'false', label: 'Status: Offen' },
      ])
    );
    const { result } = renderHook(() =>
      useFilters({ entity: 'reservations', config: reservationsFilterConfig })
    );

    expect(result.current.activeFilters).toEqual([
      expect.objectContaining({ id: 'boolean-done-false', type: 'boolean' }),
    ]);
    expect(result.current.buildFilter()).toBe('done = false');
  });

  it('drops option filters whose option no longer exists', () => {
    const stored = [
      { id: 'a', type: 'status', field: '__computed_status__', operator: '=', value: 'partially_returned', label: 'Status: Teilweise zurück' },
      { id: 'b', type: 'status', field: '__computed_status__', operator: '=', value: 'overdue', label: 'Status: Überfällig' },
    ];
    localStorage.setItem('filters_rentals', JSON.stringify(stored));

    const { result } = renderHook(() =>
      useFilters({ entity: 'rentals', config: rentalsFilterConfig })
    );

    expect(result.current.activeFilters).toEqual([stored[1]]);
  });

  it('turns stored "Heute" chips back into presets resolved on each build', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 3, 16, 9));
    const stored = [
      { id: 'a', type: 'date', field: 'expected_on', operator: '>=', value: ['2026-04-14', '2026-04-14'], label: 'Erwartet: Heute' },
      { id: 'b', type: 'date', field: 'expected_on', operator: '>=', value: ['2026-04-15', '2026-04-15'], label: 'Erwartet: Heute' },
      { id: 'c', type: 'date', field: 'rented_on', operator: '>=', value: ['2026-04-01', '2026-04-03'], label: 'Ausgeliehen: 01.04.2026 - 03.04.2026' },
    ];
    localStorage.setItem('filters_rentals', JSON.stringify(stored));

    const { result } = renderHook(() =>
      useFilters({ entity: 'rentals', config: rentalsFilterConfig })
    );

    // Both old "Heute" chips collapse into one preset; the manual range stays fixed
    expect(result.current.activeFilters.map((f) => f.value)).toEqual([
      'today',
      ['2026-04-01', '2026-04-03'],
    ]);
    expect(result.current.buildFilter()).toBe(
      "expected_on >= '2026-04-16 00:00:00' && expected_on <= '2026-04-16 23:59:59' && " +
        "rented_on >= '2026-04-01 00:00:00' && rented_on <= '2026-04-03 23:59:59'"
    );
    expect(JSON.parse(localStorage.getItem('filters_rentals') ?? '[]')[0].value).toBe('today');
  });
});
