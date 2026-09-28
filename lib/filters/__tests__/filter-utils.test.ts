import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildBookingSiblingFilter,
  buildCustomerSearchFilter,
  buildPocketBaseFilter,
  buildRecordInListFilter,
  getDatePresetRange,
  type ActiveFilter,
} from '../filter-utils';
import { rentalsFilterConfig } from '../filter-configs';

/**
 * Replace every single-quoted literal with `S`, reading it the way PocketBase's
 * filter scanner does (a quote ends the literal unless preceded by a backslash).
 * What remains is the expression structure, so any quote break-out shows up.
 */
function skeleton(filter: string): string {
  return filter.replace(/'(?:[^']|(?<=\\)')*'/g, 'S');
}

const NAME_SKELETON = 'firstname ~ S || lastname ~ S';
const FULL_NAME_SKELETON =
  '(firstname ~ S && lastname ~ S) || (firstname ~ S && lastname ~ S) || firstname ~ S || lastname ~ S';

describe('buildCustomerSearchFilter', () => {
  it('matches the iid for numeric input', () => {
    expect(buildCustomerSearchFilter('42')).toBe('iid = 42');
    expect(buildCustomerSearchFilter('007')).toBe('iid = 7');
  });

  it('matches firstname or lastname for a single term', () => {
    expect(buildCustomerSearchFilter(' Max ')).toBe("firstname ~ 'Max' || lastname ~ 'Max'");
  });

  it('matches full names in both orders', () => {
    expect(buildCustomerSearchFilter('Max Mustermann')).toBe(
      "(firstname ~ 'Max' && lastname ~ 'Mustermann') || " +
        "(firstname ~ 'Mustermann' && lastname ~ 'Max') || " +
        "firstname ~ 'Max Mustermann' || lastname ~ 'Max Mustermann'"
    );
  });

  it('escapes quotes in names', () => {
    expect(buildCustomerSearchFilter("O'Brien")).toBe(
      "firstname ~ 'O\\'Brien' || lastname ~ 'O\\'Brien'"
    );
  });

  it.each([
    ["a' || id != '", FULL_NAME_SKELETON],
    ["x' || 1=1 || lastname ~ '", FULL_NAME_SKELETON],
    ['{:v} {:v}', FULL_NAME_SKELETON],
    ["{:last} ' || id != '", FULL_NAME_SKELETON],
    ["$& $` x'", FULL_NAME_SKELETON],
    ["abc'", NAME_SKELETON],
  ])('keeps %j inside string literals', (input, expected) => {
    expect(skeleton(buildCustomerSearchFilter(input))).toBe(expected);
  });
});

describe('buildBookingSiblingFilter', () => {
  const booking = {
    item: 'abc123',
    customer_name: 'Max',
    start_date: '2026-03-01 00:00:00.000Z',
    end_date: '2026-03-05 00:00:00.000Z',
  };

  it('matches item, customer name and dates', () => {
    expect(buildBookingSiblingFilter(booking)).toBe(
      "item = 'abc123' && customer_name = 'Max' && " +
        "start_date = '2026-03-01 00:00:00.000Z' && end_date = '2026-03-05 00:00:00.000Z'"
    );
  });

  it.each(["O'Brien", "x' || customer_name != '", '{:v}', "$` ' || id != '"])(
    'cannot widen the match via customer_name %j',
    (customer_name) => {
      expect(skeleton(buildBookingSiblingFilter({ ...booking, customer_name }))).toBe(
        'item = S && customer_name = S && start_date = S && end_date = S'
      );
    }
  );
});

describe('buildPocketBaseFilter', () => {
  const notDeleted: ActiveFilter = {
    id: 'exclude-status-status-deleted',
    type: 'status',
    field: 'status',
    operator: '=',
    value: 'deleted',
    label: 'Gelöscht',
    exclude: true,
  };

  it('parenthesises excluded date ranges', () => {
    const filter = buildPocketBaseFilter([
      notDeleted,
      {
        id: 'd',
        type: 'date',
        field: 'created',
        operator: 'between',
        value: ['2026-01-01', '2026-01-31'],
        label: 'Januar',
        exclude: true,
      },
    ]);
    expect(filter).toBe(
      "status != 'deleted' && " +
        "(created < '2026-01-01 00:00:00' || created > '2026-01-31 23:59:59')"
    );
  });

  it('parenthesises excluded numeric ranges', () => {
    const filter = buildPocketBaseFilter([
      notDeleted,
      {
        id: 'n',
        type: 'numeric',
        field: 'deposit',
        operator: 'between',
        value: [10, 20],
        label: 'Pfand',
        exclude: true,
      },
    ]);
    expect(filter).toBe("status != 'deleted' && (deposit < 10 || deposit > 20)");
  });

  it.each([
    ['{:end}', "x' || id != '"],
    ["x' || id != '", '{:start}'],
  ])('keeps date range bounds %j / %j inside string literals', (start, end) => {
    const range = { id: 'd', type: 'date' as const, field: 'created', operator: '>=', value: [start, end] as [string, string], label: 'x' };
    expect(skeleton(buildPocketBaseFilter([range]))).toBe('created >= S && created <= S');
    expect(skeleton(buildPocketBaseFilter([{ ...range, exclude: true }]))).toBe('(created < S || created > S)');
  });
});

/** Included filter with defaults for the fields buildPocketBaseFilter ignores */
function filter(partial: Pick<ActiveFilter, 'type' | 'field' | 'value'> & Partial<ActiveFilter>): ActiveFilter {
  return { id: 'f', operator: '=', label: 'x', ...partial };
}

describe('buildPocketBaseFilter boolean filters', () => {
  it('compares to boolean literals, not strings', () => {
    expect(buildPocketBaseFilter([filter({ type: 'boolean', field: 'newsletter', value: 'true' })])).toBe(
      'newsletter = true'
    );
    expect(buildPocketBaseFilter([filter({ type: 'boolean', field: 'done', value: 'false' })])).toBe(
      'done = false'
    );
    expect(buildPocketBaseFilter([filter({ type: 'boolean', field: 'done', value: true })])).toBe(
      'done = true'
    );
  });

  it('negates excluded values', () => {
    expect(
      buildPocketBaseFilter([filter({ type: 'boolean', field: 'is_new_customer', value: 'true', exclude: true })])
    ).toBe('is_new_customer != true');
  });

  it('ORs both values of the same field', () => {
    expect(
      buildPocketBaseFilter([
        filter({ type: 'boolean', field: 'newsletter', value: 'true' }),
        filter({ type: 'boolean', field: 'newsletter', value: 'false' }),
      ])
    ).toBe('(newsletter = true || newsletter = false)');
  });
});

describe('buildPocketBaseFilter category filters', () => {
  const multi = { multiValueFields: ['category'] };

  it('matches any selected value of a multi-select', () => {
    expect(buildPocketBaseFilter([filter({ type: 'category', field: 'category', value: 'Küche' })], '', multi)).toBe(
      "category:each ?= 'Küche'"
    );
    expect(
      buildPocketBaseFilter(
        [
          filter({ type: 'category', field: 'category', value: 'Küche' }),
          filter({ type: 'category', field: 'category', value: 'Garten' }),
        ],
        '',
        multi
      )
    ).toBe("(category:each ?= 'Küche' || category:each ?= 'Garten')");
  });

  it('excludes a value only when no element equals it', () => {
    expect(
      buildPocketBaseFilter([filter({ type: 'category', field: 'category', value: 'Küche', exclude: true })], '', multi)
    ).toBe("category:each != 'Küche'");
  });

  it('uses :length for "no category" on a multi-select', () => {
    expect(buildPocketBaseFilter([filter({ type: 'category', field: 'category', value: '__none__' })], '', multi)).toBe(
      'category:length = 0'
    );
    expect(
      buildPocketBaseFilter([filter({ type: 'category', field: 'category', value: '__none__', exclude: true })], '', multi)
    ).toBe('category:length > 0');
  });

  it('keeps plain comparisons for single-valued fields', () => {
    expect(buildPocketBaseFilter([filter({ type: 'category', field: 'highlight_color', value: 'red' })], '', multi)).toBe(
      "highlight_color = 'red'"
    );
    expect(buildPocketBaseFilter([filter({ type: 'category', field: 'data.method', value: '__none__' })], '', multi)).toBe(
      "(data.method = '' || data.method = null)"
    );
  });
});

describe('buildPocketBaseFilter search placeholder', () => {
  it('keeps the search term as typed', () => {
    expect(buildPocketBaseFilter([], 'Öztürk')).toBe('__SEARCH__:"Öztürk"');
  });
});

describe('getDatePresetRange', () => {
  // Local-time dates, so the results don't depend on the machine's time zone
  const wednesday = new Date(2026, 3, 15, 12);
  const sunday = new Date(2026, 2, 1, 12);

  it('resolves days', () => {
    expect(getDatePresetRange('today', wednesday)).toEqual({ start: '2026-04-15', end: '2026-04-15' });
    expect(getDatePresetRange('yesterday', wednesday)).toEqual({ start: '2026-04-14', end: '2026-04-14' });
    expect(getDatePresetRange('yesterday', sunday)).toEqual({ start: '2026-02-28', end: '2026-02-28' });
  });

  it('resolves Monday–Sunday weeks', () => {
    expect(getDatePresetRange('this_week', wednesday)).toEqual({ start: '2026-04-13', end: '2026-04-19' });
    expect(getDatePresetRange('last_week', wednesday)).toEqual({ start: '2026-04-06', end: '2026-04-12' });
    // A Sunday still belongs to the week that started the Monday before
    expect(getDatePresetRange('this_week', sunday)).toEqual({ start: '2026-02-23', end: '2026-03-01' });
    expect(getDatePresetRange('last_week', sunday)).toEqual({ start: '2026-02-16', end: '2026-02-22' });
  });
});

describe('buildPocketBaseFilter date presets', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves the preset when the filter is built, not when it was added', () => {
    const today = filter({ type: 'date', field: 'expected_on', value: 'today' });
    vi.useFakeTimers({ toFake: ['Date'] });

    vi.setSystemTime(new Date(2026, 3, 15, 12));
    expect(buildPocketBaseFilter([today])).toBe(
      "expected_on >= '2026-04-15 00:00:00' && expected_on <= '2026-04-15 23:59:59'"
    );

    vi.setSystemTime(new Date(2026, 3, 16, 9));
    expect(buildPocketBaseFilter([today])).toBe(
      "expected_on >= '2026-04-16 00:00:00' && expected_on <= '2026-04-16 23:59:59'"
    );
    expect(buildPocketBaseFilter([{ ...today, exclude: true }])).toBe(
      "(expected_on < '2026-04-16 00:00:00' || expected_on > '2026-04-16 23:59:59')"
    );
  });
});

describe('buildRecordInListFilter', () => {
  it('scopes the list filter to one record', () => {
    expect(buildRecordInListFilter('abc123', "status != 'deleted' || iid = 5")).toBe(
      "id = 'abc123' && (status != 'deleted' || iid = 5)"
    );
  });

  it('matches just the record without a list filter', () => {
    expect(buildRecordInListFilter('abc123', '')).toBe("id = 'abc123'");
  });
});

describe('rental status filter options', () => {
  it('does not offer "partially returned", which has no server-side condition', () => {
    const values = rentalsFilterConfig.statusFilters?.[0].options?.map((o) => o.value);
    expect(values).not.toContain('partially_returned');
    expect(values).toEqual(
      expect.arrayContaining(['active', 'overdue', 'due_today', 'returned', 'returned_today'])
    );
  });
});
