import type { ColumnType } from '../types';

const LABELS: Record<ColumnType, string> = {
  number: '123',
  date: 'date',
  boolean: 'y/n',
  string: 'abc',
};

const TITLES: Record<ColumnType, string> = {
  number: 'Numeric column — filtered by range',
  date: 'Date column — filtered by range',
  boolean: 'Boolean column — filtered by value',
  string: 'Text column — filtered by match',
};

/** Small badge showing the type the app inferred for a column. */
export function TypeBadge({ type }: { type: ColumnType }) {
  return (
    <span className={`type-badge type-badge--${type}`} title={TITLES[type]}>
      {LABELS[type]}
    </span>
  );
}
