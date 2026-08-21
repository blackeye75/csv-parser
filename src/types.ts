/** Value types the app can infer for a column, in order of specificity. */
export type ColumnType = 'number' | 'date' | 'boolean' | 'string';

export interface Column {
  /** Stable identifier. Derived from the position, so duplicate headers never collide. */
  key: string;
  /** Header text shown to the user. */
  name: string;
  /** Position of this column inside every row tuple. */
  index: number;
  type: ColumnType;
  /**
   * Distinct non-empty values, capped at CATEGORICAL_LIMIT. When the cap is hit
   * the column is not categorical and this is empty.
   */
  distinctValues: string[];
}

/** A row is a positional tuple of raw cell strings — cheaper than an object per row. */
export type Row = string[];

export interface Dataset {
  columns: Column[];
  rows: Row[];
  /** Rows the parser could read but that had a different width than the header. */
  malformedRowCount: number;
  fileName: string;
  fileSize: number;
  delimiter: string;
}

export type TextMode = 'contains' | 'notContains' | 'equals' | 'startsWith' | 'empty' | 'notEmpty';

export type Filter =
  | { kind: 'text'; mode: TextMode; value: string }
  | { kind: 'number'; min: string; max: string }
  | { kind: 'date'; from: string; to: string }
  | { kind: 'set'; selected: string[] };

/** Filters live in a map keyed by Column.key, so lookups stay O(1) per row. */
export type FilterMap = Record<string, Filter>;

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  columnKey: string;
  direction: SortDirection;
}
