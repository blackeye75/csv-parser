import type { Column, Filter, FilterMap, Row, SortDirection, SortState } from '../types';
import { parseDate, parseNumber } from './values';

/** True when a filter would not narrow anything down, so it can be skipped. */
export function isFilterActive(filter: Filter | undefined): filter is Filter {
  if (!filter) return false;
  switch (filter.kind) {
    case 'text':
      return filter.mode === 'empty' || filter.mode === 'notEmpty' || filter.value.trim() !== '';
    case 'number':
      return filter.min.trim() !== '' || filter.max.trim() !== '';
    case 'date':
      return filter.from !== '' || filter.to !== '';
    case 'set':
      return filter.selected.length > 0;
  }
}

function matchesText(cell: string, filter: Extract<Filter, { kind: 'text' }>): boolean {
  const haystack = cell.toLowerCase();
  const needle = filter.value.trim().toLowerCase();

  switch (filter.mode) {
    case 'contains':
      return haystack.includes(needle);
    case 'notContains':
      return !haystack.includes(needle);
    case 'equals':
      return haystack.trim() === needle;
    case 'startsWith':
      return haystack.trimStart().startsWith(needle);
    case 'empty':
      return cell.trim() === '';
    case 'notEmpty':
      return cell.trim() !== '';
  }
}

function matchesNumber(cell: string, filter: Extract<Filter, { kind: 'number' }>): boolean {
  const value = parseNumber(cell);
  if (value === null) return false; // Blank/non-numeric cells fall outside any range.

  const min = parseNumber(filter.min);
  const max = parseNumber(filter.max);
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

function matchesDate(cell: string, filter: Extract<Filter, { kind: 'date' }>): boolean {
  const value = parseDate(cell);
  if (value === null) return false;

  const from = filter.from ? parseDate(filter.from) : null;
  const to = filter.to ? parseDate(filter.to) : null;
  if (from !== null && value < from) return false;
  // `to` is inclusive of the whole day the user picked.
  if (to !== null && value > to + 24 * 60 * 60 * 1000 - 1) return false;
  return true;
}

function matchesFilter(cell: string, filter: Filter): boolean {
  switch (filter.kind) {
    case 'text':
      return matchesText(cell, filter);
    case 'number':
      return matchesNumber(cell, filter);
    case 'date':
      return matchesDate(cell, filter);
    case 'set':
      return filter.selected.includes(cell.trim());
  }
}

export interface QueryOptions {
  columns: Column[];
  rows: Row[];
  filters: FilterMap;
  /** Matches a row when any cell contains this text. */
  search: string;
  sort: SortState | null;
}

/**
 * Applies every active column filter, then the global search, then the sort.
 *
 * Filters are AND-ed together (each one narrows the previous result) and the
 * active ones are resolved to `[columnIndex, filter]` pairs up front, so the
 * per-row work is proportional to the number of *active* filters rather than
 * to the number of columns.
 */
export function queryRows({ columns, rows, filters, search, sort }: QueryOptions): Row[] {
  const activeFilters: Array<[number, Filter]> = [];
  for (const column of columns) {
    const filter = filters[column.key];
    if (isFilterActive(filter)) activeFilters.push([column.index, filter]);
  }

  const needle = search.trim().toLowerCase();
  let result = rows;

  if (activeFilters.length > 0) {
    result = result.filter((row) =>
      activeFilters.every(([index, filter]) => matchesFilter(row[index] ?? '', filter)),
    );
  }

  if (needle !== '') {
    result = result.filter((row) => row.some((cell) => cell.toLowerCase().includes(needle)));
  }

  if (sort) {
    const column = columns.find((c) => c.key === sort.columnKey);
    if (column) {
      // Copy first: sorting the filtered array in place would mutate `rows`
      // whenever no filter narrowed it.
      result = [...result].sort(makeComparator(column, sort.direction));
    }
  }

  return result;
}

/**
 * Builds a row comparator for a column.
 *
 * Blank cells are held at the end in both directions — flipping them to the top
 * on a descending sort would bury the rows the user actually wants to see.
 */
export function makeComparator(column: Column, direction: SortDirection) {
  const factor = direction === 'asc' ? 1 : -1;

  return (a: Row, b: Row): number => {
    const left = a[column.index] ?? '';
    const right = b[column.index] ?? '';
    const leftEmpty = left.trim() === '';
    const rightEmpty = right.trim() === '';
    if (leftEmpty || rightEmpty) return leftEmpty && rightEmpty ? 0 : leftEmpty ? 1 : -1;
    return factor * compareCells(left, right, column);
  };
}

/** Compares two non-blank cells using the column's inferred type. */
export function compareCells(a: string, b: string, column: Column): number {
  if (column.type === 'number') {
    const left = parseNumber(a);
    const right = parseNumber(b);
    if (left !== null && right !== null) return left - right;
  }

  if (column.type === 'date') {
    const left = parseDate(a);
    const right = parseDate(b);
    if (left !== null && right !== null) return left - right;
  }

  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** The empty filter shape for a column, based on its inferred type. */
export function emptyFilterFor(column: Column): Filter {
  if (column.distinctValues.length > 0 && column.type !== 'number' && column.type !== 'date') {
    return { kind: 'set', selected: [] };
  }
  switch (column.type) {
    case 'number':
      return { kind: 'number', min: '', max: '' };
    case 'date':
      return { kind: 'date', from: '', to: '' };
    case 'boolean':
      return { kind: 'set', selected: [] };
    default:
      return { kind: 'text', mode: 'contains', value: '' };
  }
}
