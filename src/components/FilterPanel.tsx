import { useMemo, useState } from 'react';
import type { Column, Filter, FilterMap, Row } from '../types';
import { isFilterActive } from '../lib/filtering';
import { columnRange } from '../lib/stats';
import { ColumnFilter } from './ColumnFilter';
import { TypeBadge } from './TypeBadge';

interface FilterPanelProps {
  columns: Column[];
  rows: Row[];
  filters: FilterMap;
  onFilterChange: (columnKey: string, filter: Filter) => void;
  onClearColumn: (columnKey: string) => void;
  onClearAll: () => void;
}

/** Sidebar with one filter control per column, plus a column search. */
export function FilterPanel({
  columns,
  rows,
  filters,
  onFilterChange,
  onClearColumn,
  onClearAll,
}: FilterPanelProps) {
  const [columnQuery, setColumnQuery] = useState('');

  // Ranges depend only on the source rows, so they stay stable while filtering.
  const ranges = useMemo(() => {
    const map: Record<string, ReturnType<typeof columnRange>> = {};
    for (const column of columns) {
      map[column.key] =
        column.type === 'number' || column.type === 'date' ? columnRange(rows, column) : null;
    }
    return map;
  }, [columns, rows]);

  const visibleColumns = useMemo(() => {
    const needle = columnQuery.trim().toLowerCase();
    return needle ? columns.filter((c) => c.name.toLowerCase().includes(needle)) : columns;
  }, [columns, columnQuery]);

  const activeCount = columns.filter((column) => isFilterActive(filters[column.key])).length;

  return (
    <aside className="panel" aria-label="Column filters">
      <header className="panel__header">
        <h2 className="panel__title">
          Filters
          {activeCount > 0 && <span className="pill">{activeCount} active</span>}
        </h2>
        {activeCount > 0 && (
          <button type="button" className="link-button small" onClick={onClearAll}>
            Clear all
          </button>
        )}
      </header>

      {columns.length > 8 && (
        <input
          type="search"
          className="input panel__search"
          placeholder="Find a column…"
          aria-label="Find a column"
          value={columnQuery}
          onChange={(event) => setColumnQuery(event.target.value)}
        />
      )}

      <div className="panel__body">
        {visibleColumns.map((column) => {
          const filter = filters[column.key];
          const active = isFilterActive(filter);

          return (
            <section
              key={column.key}
              className={`filter-group${active ? ' filter-group--active' : ''}`}
            >
              <div className="filter-group__header">
                <span className="filter-group__name" title={column.name}>
                  {column.name}
                </span>
                <TypeBadge type={column.type} />
                {active && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Clear the ${column.name} filter`}
                    title="Clear this filter"
                    onClick={() => onClearColumn(column.key)}
                  >
                    ×
                  </button>
                )}
              </div>

              {filter && (
                <ColumnFilter
                  column={column}
                  filter={filter}
                  range={ranges[column.key]}
                  onChange={(next) => onFilterChange(column.key, next)}
                />
              )}
            </section>
          );
        })}

        {visibleColumns.length === 0 && <p className="muted small">No columns match that name.</p>}
      </div>
    </aside>
  );
}
