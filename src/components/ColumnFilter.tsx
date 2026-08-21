import { useMemo, useState } from 'react';
import type { Column, Filter, TextMode } from '../types';
import type { ColumnRange } from '../lib/stats';

interface ColumnFilterProps {
  column: Column;
  filter: Filter;
  range: ColumnRange | null;
  onChange: (filter: Filter) => void;
}

const TEXT_MODES: Array<{ value: TextMode; label: string }> = [
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'does not contain' },
  { value: 'equals', label: 'equals' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'empty', label: 'is empty' },
  { value: 'notEmpty', label: 'is not empty' },
];

/** Renders the filter control that matches the column's inferred type. */
export function ColumnFilter({ column, filter, range, onChange }: ColumnFilterProps) {
  switch (filter.kind) {
    case 'number':
      return (
        <div className="filter-row">
          <input
            type="number"
            className="input"
            aria-label={`Minimum ${column.name}`}
            placeholder={range ? `min ${range.min}` : 'min'}
            value={filter.min}
            onChange={(event) => onChange({ ...filter, min: event.target.value })}
          />
          <span className="filter-row__sep" aria-hidden="true">
            –
          </span>
          <input
            type="number"
            className="input"
            aria-label={`Maximum ${column.name}`}
            placeholder={range ? `max ${range.max}` : 'max'}
            value={filter.max}
            onChange={(event) => onChange({ ...filter, max: event.target.value })}
          />
        </div>
      );

    case 'date':
      return (
        <div className="filter-row">
          <input
            type="date"
            className="input"
            aria-label={`${column.name} from`}
            min={range?.min}
            max={range?.max}
            value={filter.from}
            onChange={(event) => onChange({ ...filter, from: event.target.value })}
          />
          <span className="filter-row__sep" aria-hidden="true">
            –
          </span>
          <input
            type="date"
            className="input"
            aria-label={`${column.name} to`}
            min={range?.min}
            max={range?.max}
            value={filter.to}
            onChange={(event) => onChange({ ...filter, to: event.target.value })}
          />
        </div>
      );

    case 'set':
      return <SetFilter column={column} filter={filter} onChange={onChange} />;

    case 'text':
      return (
        <div className="filter-stack">
          <select
            className="input select"
            aria-label={`How to match ${column.name}`}
            value={filter.mode}
            onChange={(event) => onChange({ ...filter, mode: event.target.value as TextMode })}
          >
            {TEXT_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
          {filter.mode !== 'empty' && filter.mode !== 'notEmpty' && (
            <input
              type="search"
              className="input"
              aria-label={`Filter ${column.name}`}
              placeholder={`Filter ${column.name}…`}
              value={filter.value}
              onChange={(event) => onChange({ ...filter, value: event.target.value })}
            />
          )}
        </div>
      );
  }
}

interface SetFilterProps {
  column: Column;
  filter: Extract<Filter, { kind: 'set' }>;
  onChange: (filter: Filter) => void;
}

/** Checkbox list for categorical columns, with a search box once the list grows. */
function SetFilter({ column, filter, onChange }: SetFilterProps) {
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    const values =
      column.distinctValues.length > 0
        ? column.distinctValues
        : ['true', 'false']; // Boolean columns without a distinct list.
    const needle = query.trim().toLowerCase();
    return needle ? values.filter((value) => value.toLowerCase().includes(needle)) : values;
  }, [column.distinctValues, query]);

  const toggle = (value: string) => {
    const selected = filter.selected.includes(value)
      ? filter.selected.filter((item) => item !== value)
      : [...filter.selected, value];
    onChange({ ...filter, selected });
  };

  return (
    <div className="filter-stack">
      {column.distinctValues.length > 8 && (
        <input
          type="search"
          className="input"
          aria-label={`Search ${column.name} values`}
          placeholder="Search values…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}

      <div className="checkbox-list" role="group" aria-label={`${column.name} values`}>
        {options.map((value) => (
          <label key={value} className="checkbox">
            <input
              type="checkbox"
              checked={filter.selected.includes(value)}
              onChange={() => toggle(value)}
            />
            <span className="checkbox__label" title={value}>
              {value}
            </span>
          </label>
        ))}
        {options.length === 0 && <p className="muted small">No matching values.</p>}
      </div>

      {filter.selected.length > 0 && (
        <button
          type="button"
          className="link-button small"
          onClick={() => onChange({ ...filter, selected: [] })}
        >
          Clear {filter.selected.length} selected
        </button>
      )}
    </div>
  );
}
