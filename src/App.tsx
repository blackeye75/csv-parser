import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable } from './components/DataTable';
import { FileDropzone } from './components/FileDropzone';
import { FilterPanel } from './components/FilterPanel';
import { Pagination } from './components/Pagination';
import { Toolbar } from './components/Toolbar';
import { useCsvFile } from './hooks/useCsvFile';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { toCsv } from './lib/csv';
import { emptyFilterFor, isFilterActive, queryRows } from './lib/filtering';
import { downloadTextFile, formatCount } from './lib/format';
import { SAMPLE_CSV } from './lib/sampleData';
import type { Filter, FilterMap, SortState } from './types';

const DEFAULT_PAGE_SIZE = 50;

export default function App() {
  const { dataset, status, error, loadFile, loadText, reset } = useCsvFile();

  const [filters, setFilters] = useState<FilterMap>({});
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Debounced so typing in a filter or the search box does not re-scan the
  // rows on every keystroke.
  const debouncedFilters = useDebouncedValue(filters, 180);
  const debouncedSearch = useDebouncedValue(search, 180);

  // A new file invalidates every column-scoped piece of view state.
  useEffect(() => {
    if (!dataset) return;
    const next: FilterMap = {};
    for (const column of dataset.columns) next[column.key] = emptyFilterFor(column);
    setFilters(next);
    setSearch('');
    setSort(null);
    setHiddenColumns(new Set());
    setPage(0);
    setPageSize(DEFAULT_PAGE_SIZE);
  }, [dataset]);

  const visibleColumns = useMemo(
    () => dataset?.columns.filter((column) => !hiddenColumns.has(column.key)) ?? [],
    [dataset, hiddenColumns],
  );

  const filteredRows = useMemo(() => {
    if (!dataset) return [];
    return queryRows({
      columns: dataset.columns,
      rows: dataset.rows,
      filters: debouncedFilters,
      search: debouncedSearch,
      sort,
    });
  }, [dataset, debouncedFilters, debouncedSearch, sort]);

  const pageCount = Math.ceil(filteredRows.length / pageSize);

  // Narrowing the result set can strand the user past the last page.
  useEffect(() => {
    if (page > 0 && page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const pageRows = useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page, pageSize],
  );

  const setFilter = useCallback((columnKey: string, filter: Filter) => {
    setFilters((current) => ({ ...current, [columnKey]: filter }));
    setPage(0);
  }, []);

  const clearColumn = useCallback(
    (columnKey: string) => {
      const column = dataset?.columns.find((c) => c.key === columnKey);
      if (column) setFilter(columnKey, emptyFilterFor(column));
    },
    [dataset, setFilter],
  );

  const clearAllFilters = useCallback(() => {
    if (!dataset) return;
    const cleared: FilterMap = {};
    for (const column of dataset.columns) cleared[column.key] = emptyFilterFor(column);
    setFilters(cleared);
    setSearch('');
    setPage(0);
  }, [dataset]);

  const toggleSort = useCallback((columnKey: string) => {
    // Cycles ascending → descending → unsorted, so the original file order
    // stays reachable.
    setSort((current) => {
      if (current?.columnKey !== columnKey) return { columnKey, direction: 'asc' };
      if (current.direction === 'asc') return { columnKey, direction: 'desc' };
      return null;
    });
  }, []);

  const toggleColumn = useCallback((columnKey: string) => {
    setHiddenColumns((current) => {
      const next = new Set(current);
      if (next.has(columnKey)) next.delete(columnKey);
      else next.add(columnKey);
      return next;
    });
  }, []);

  /** Exports exactly what is on screen: visible columns, filtered + sorted rows. */
  const exportCsv = useCallback(() => {
    if (!dataset) return;
    const header = visibleColumns.map((column) => column.name);
    const rows = filteredRows.map((row) => visibleColumns.map((column) => row[column.index] ?? ''));
    const base = dataset.fileName.replace(/\.[^.]+$/, '');
    downloadTextFile(toCsv(header, rows), `${base}-filtered.csv`);
  }, [dataset, filteredRows, visibleColumns]);

  if (!dataset) {
    return (
      <main className="app app--empty">
        <div className="hero">
          <h1 className="hero__title">CSV Explorer</h1>
          <p className="hero__subtitle">
            Upload a CSV file to browse, search, sort and filter it column by column. Everything
            runs in your browser — no file ever leaves this device.
          </p>

          <FileDropzone
            onFile={loadFile}
            onUseSample={() => loadText(SAMPLE_CSV, 'sample-employees.csv')}
            disabled={status === 'loading'}
          />

          {status === 'loading' && (
            <p className="status status--busy" role="status">
              Reading file…
            </p>
          )}
          {status === 'error' && error && (
            <p className="status status--error" role="alert">
              {error}
            </p>
          )}

          <ul className="hero__features">
            <li>Detects comma, semicolon, tab and pipe delimiters</li>
            <li>Infers a type per column and offers a matching filter</li>
            <li>Handles quoted fields, escaped quotes and embedded newlines</li>
            <li>Exports whatever the current filters leave on screen</li>
          </ul>
        </div>
      </main>
    );
  }

  const activeFilterCount = dataset.columns.filter((column) =>
    isFilterActive(debouncedFilters[column.key]),
  ).length;

  return (
    <main className="app">
      <Toolbar
        dataset={dataset}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        hiddenColumns={hiddenColumns}
        onToggleColumn={toggleColumn}
        onShowAllColumns={() => setHiddenColumns(new Set())}
        filteredCount={filteredRows.length}
        onExport={exportCsv}
        onReset={reset}
      />

      {dataset.malformedRowCount > 0 && (
        <p className="status status--warning" role="status">
          {formatCount(dataset.malformedRowCount)}{' '}
          {dataset.malformedRowCount === 1 ? 'row did' : 'rows did'} not match the header width and{' '}
          {dataset.malformedRowCount === 1 ? 'was' : 'were'} padded or truncated to fit.
        </p>
      )}

      <div className="layout">
        <FilterPanel
          columns={dataset.columns}
          rows={dataset.rows}
          filters={filters}
          onFilterChange={setFilter}
          onClearColumn={clearColumn}
          onClearAll={clearAllFilters}
        />

        <section className="content" aria-label="Results">
          {filteredRows.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">No rows match the current filters</p>
              <p className="muted">
                {activeFilterCount > 0 || search
                  ? 'Try widening a range or clearing a filter.'
                  : 'This file has no data rows.'}
              </p>
              {(activeFilterCount > 0 || search) && (
                <button type="button" className="button" onClick={clearAllFilters}>
                  Clear all filters
                </button>
              )}
            </div>
          ) : visibleColumns.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">Every column is hidden</p>
              <button type="button" className="button" onClick={() => setHiddenColumns(new Set())}>
                Show all columns
              </button>
            </div>
          ) : (
            <>
              <DataTable
                columns={visibleColumns}
                rows={pageRows}
                sort={sort}
                onSort={toggleSort}
                highlight={debouncedSearch}
                startIndex={page * pageSize}
              />
              <Pagination
                page={page}
                pageCount={pageCount}
                pageSize={pageSize}
                totalRows={filteredRows.length}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(0);
                }}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
