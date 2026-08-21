import { memo } from 'react';
import type { Column, Row, SortState } from '../types';

interface DataTableProps {
  columns: Column[];
  rows: Row[];
  sort: SortState | null;
  onSort: (columnKey: string) => void;
  /** Global search term, highlighted inside the cells it matched. */
  highlight: string;
  /** Index of the first row on this page, for the row-number gutter. */
  startIndex: number;
}

/** Scrollable, sortable table with a sticky header and a row-number gutter. */
export function DataTable({ columns, rows, sort, onSort, highlight, startIndex }: DataTableProps) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="CSV data">
      <table className="table">
        <thead>
          <tr>
            <th className="table__gutter" scope="col">
              <span className="visually-hidden">Row number</span>
            </th>
            {columns.map((column) => {
              const isSorted = sort?.columnKey === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    className="table__sort"
                    onClick={() => onSort(column.key)}
                    title={`Sort by ${column.name}`}
                  >
                    <span className="table__label">{column.name}</span>
                    <span className={`table__arrow${isSorted ? ' table__arrow--on' : ''}`} aria-hidden="true">
                      {isSorted && sort.direction === 'desc' ? '↓' : '↑'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={startIndex + rowIndex}>
              <td className="table__gutter">{startIndex + rowIndex + 1}</td>
              {columns.map((column) => (
                <Cell
                  key={column.key}
                  value={row[column.index] ?? ''}
                  numeric={column.type === 'number'}
                  highlight={highlight}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CellProps {
  value: string;
  numeric: boolean;
  highlight: string;
}

/**
 * Memoised so re-rendering the table (a sort, a page change) only re-renders
 * the cells whose value actually changed.
 */
const Cell = memo(function Cell({ value, numeric, highlight }: CellProps) {
  return (
    <td className={numeric ? 'table__cell table__cell--numeric' : 'table__cell'} title={value}>
      {value === '' ? <span className="table__empty">—</span> : highlightMatch(value, highlight)}
    </td>
  );
});

/** Wraps every occurrence of `needle` in a <mark>, without using dangerouslySetInnerHTML. */
function highlightMatch(value: string, needle: string) {
  const term = needle.trim().toLowerCase();
  if (term === '') return value;

  const haystack = value.toLowerCase();
  const parts: Array<string | JSX.Element> = [];
  let cursor = 0;
  let found = haystack.indexOf(term);

  while (found !== -1) {
    if (found > cursor) parts.push(value.slice(cursor, found));
    parts.push(
      <mark key={found} className="mark">
        {value.slice(found, found + term.length)}
      </mark>,
    );
    cursor = found + term.length;
    found = haystack.indexOf(term, cursor);
  }

  if (cursor === 0) return value;
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}
