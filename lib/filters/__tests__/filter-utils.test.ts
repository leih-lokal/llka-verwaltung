import { describe, it, expect } from 'vitest';
import {
  buildBookingSiblingFilter,
  buildCustomerSearchFilter,
  buildPocketBaseFilter,
  type ActiveFilter,
} from '../filter-utils';

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
});
