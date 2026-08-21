import { useEffect, useRef, useState } from 'react';
import type { Column, Dataset } from '../types';
import { delimiterLabel, formatBytes, formatCount } from '../lib/format';

interface ToolbarProps {
  dataset: Dataset;
  search: string;
  onSearchChange: (value: string) => void;
  hiddenColumns: Set<string>;
  onToggleColumn: (columnKey: string) => void;
  onShowAllColumns: () => void;
  filteredCount: number;
  onExport: () => void;
  onReset: () => void;
}

/** File summary, global search, column visibility, export and reset. */
export function Toolbar({
  dataset,
  search,
  onSearchChange,
  hiddenColumns,
  onToggleColumn,
  onShowAllColumns,
  filteredCount,
  onExport,
  onReset,
}: ToolbarProps) {
  const total = dataset.rows.length;
  const isFiltered = filteredCount !== total;

  return (
    <header className="toolbar">
      <div className="toolbar__file">
        <h1 className="toolbar__name" title={dataset.fileName}>
          {dataset.fileName}
        </h1>
        <p className="toolbar__meta">
          {formatCount(total)} rows · {dataset.columns.length} columns ·{' '}
          {formatBytes(dataset.fileSize)} · {delimiterLabel(dataset.delimiter)}-separated
          {isFiltered && (
            <>
              {' '}
              · <strong className="toolbar__match">{formatCount(filteredCount)} matching</strong>
            </>
          )}
        </p>
      </div>

      <div className="toolbar__actions">
        <div className="search">
          <svg className="search__icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            className="input search__input"
            placeholder="Search all columns…"
            aria-label="Search all columns"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <ColumnsMenu
          columns={dataset.columns}
          hiddenColumns={hiddenColumns}
          onToggleColumn={onToggleColumn}
          onShowAll={onShowAllColumns}
        />

        <button
          type="button"
          className="button"
          onClick={onExport}
          disabled={filteredCount === 0}
          title="Download the rows and columns currently shown"
        >
          Export CSV
        </button>

        <button type="button" className="button button--ghost" onClick={onReset}>
          New file
        </button>
      </div>
    </header>
  );
}

interface ColumnsMenuProps {
  columns: Column[];
  hiddenColumns: Set<string>;
  onToggleColumn: (columnKey: string) => void;
  onShowAll: () => void;
}

/** Dropdown of checkboxes controlling which columns the table renders. */
function ColumnsMenu({ columns, hiddenColumns, onToggleColumn, onShowAll }: ColumnsMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape, the way a native menu behaves.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const visibleCount = columns.length - hiddenColumns.size;

  return (
    <div className="menu" ref={containerRef}>
      <button
        type="button"
        className="button button--ghost"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        Columns
        <span className="pill pill--quiet">
          {visibleCount}/{columns.length}
        </span>
      </button>

      {open && (
        <div className="menu__popover" role="group" aria-label="Toggle column visibility">
          <div className="menu__body">
            {columns.map((column) => (
              <label key={column.key} className="checkbox">
                <input
                  type="checkbox"
                  checked={!hiddenColumns.has(column.key)}
                  onChange={() => onToggleColumn(column.key)}
                />
                <span className="checkbox__label" title={column.name}>
                  {column.name}
                </span>
              </label>
            ))}
          </div>
          {hiddenColumns.size > 0 && (
            <button type="button" className="link-button small menu__footer" onClick={onShowAll}>
              Show all columns
            </button>
          )}
        </div>
      )}
    </div>
  );
}
