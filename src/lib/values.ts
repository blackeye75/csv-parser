import type { ColumnType } from '../types';

/** A column with more distinct values than this is treated as free text, not a category. */
export const CATEGORICAL_LIMIT = 25;

/** Rows sampled when inferring a column's type. Keeps inference O(1) in file size. */
export const TYPE_SAMPLE_SIZE = 200;

/** Share of non-empty sampled cells that must match a type before it is adopted. */
const TYPE_CONFIDENCE = 0.9;

const TRUE_VALUES = new Set(['true', 'yes', 'y', '1']);
const FALSE_VALUES = new Set(['false', 'no', 'n', '0']);

/**
 * Parses a number, tolerating thousands separators, currency symbols,
 * percentages and accounting-style negatives — the shapes real exports use.
 */
export function parseNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const isParenthesised = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed
    .replace(/^\(|\)$/g, '')
    .replace(/[$€£¥₹\s,%]/g, '')
    .replace(/,/g, '');

  if (cleaned === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(cleaned)) return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return isParenthesised ? -value : value;
}

/**
 * Parses ISO-ish dates (`2024-01-31`, with optional time) and the common
 * slash formats. Deliberately strict: `Date.parse` alone would happily accept
 * strings like "12 apples" in some engines.
 */
export function parseDate(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(trimmed);
  if (iso) {
    const [, y, m, d, hh = '0', mm = '0', ss = '0'] = iso;
    const value = Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss);
    // Reject impossible calendar dates such as 2024-02-31.
    const check = new Date(value);
    if (check.getUTCMonth() !== +m - 1 || check.getUTCDate() !== +d) return null;
    return value;
  }

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slash) {
    // Ambiguous between D/M/Y and M/D/Y; assume M/D/Y and fall back when the
    // first part cannot be a month.
    const [, a, b, y] = slash;
    const [month, day] = +a > 12 ? [+b, +a] : [+a, +b];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return Date.UTC(+y, month - 1, day);
  }

  return null;
}

export function parseBoolean(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(value)) return false;
  return null;
}

/**
 * Infers a column's type from a sample of its cells.
 *
 * Booleans are checked before numbers because `0`/`1` parse as both, and a
 * column of only zeroes and ones reads better as a toggle than as a range.
 */
export function inferColumnType(cells: string[]): ColumnType {
  const sample = cells.slice(0, TYPE_SAMPLE_SIZE).filter((cell) => cell.trim() !== '');
  if (sample.length === 0) return 'string';

  const threshold = sample.length * TYPE_CONFIDENCE;
  let booleans = 0;
  let numbers = 0;
  let dates = 0;

  for (const cell of sample) {
    if (parseBoolean(cell) !== null) booleans++;
    if (parseNumber(cell) !== null) numbers++;
    if (parseDate(cell) !== null) dates++;
  }

  if (booleans >= threshold) return 'boolean';
  if (dates >= threshold) return 'date';
  if (numbers >= threshold) return 'number';
  return 'string';
}

/**
 * Collects the distinct values of a column when it reads as a category, and
 * returns an empty list when it does not.
 *
 * A column is categorical when it has at most CATEGORICAL_LIMIT distinct
 * values *and* those values repeat. The second condition matters: in a 20-row
 * file an id or name column also has few distinct values, but offering 20
 * checkboxes each matching one row is useless — those columns want a text
 * filter. The loop bails out as soon as the cap is passed, so a 100k-row id
 * column costs almost nothing.
 */
export function collectDistinctValues(cells: string[]): string[] {
  const seen = new Set<string>();
  let nonEmpty = 0;

  for (const cell of cells) {
    const value = cell.trim();
    if (value === '') continue;
    nonEmpty++;
    seen.add(value);
    if (seen.size > CATEGORICAL_LIMIT) return [];
  }

  if (nonEmpty > 1 && seen.size === nonEmpty) return []; // Every value unique.
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
