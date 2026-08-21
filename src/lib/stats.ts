import type { Column, Row } from '../types';
import { parseDate, parseNumber } from './values';

export interface ColumnRange {
  min: string;
  max: string;
}

/**
 * Min/max of a numeric or date column, used to hint at the available range in
 * the filter inputs. Returns null when the column has no parseable values.
 */
export function columnRange(rows: Row[], column: Column): ColumnRange | null {
  const parse = column.type === 'date' ? parseDate : parseNumber;
  let min = Infinity;
  let max = -Infinity;

  for (const row of rows) {
    const value = parse(row[column.index] ?? '');
    if (value === null) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (min === Infinity) return null;

  if (column.type === 'date') {
    return { min: toDateInput(min), max: toDateInput(max) };
  }
  return { min: String(min), max: String(max) };
}

/** Formats a timestamp as the `yyyy-mm-dd` value an `<input type="date">` expects. */
export function toDateInput(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
