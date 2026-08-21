import { formatCount } from '../lib/format';

interface PaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [25, 50, 100, 250, 500];

/** Page controls plus the "showing x–y of z" summary. */
export function Pagination({
  page,
  pageCount,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const first = totalRows === 0 ? 0 : page * pageSize + 1;
  const last = Math.min((page + 1) * pageSize, totalRows);

  return (
    <div className="pagination">
      <p className="pagination__summary" aria-live="polite">
        {totalRows === 0
          ? 'No rows to show'
          : `Showing ${formatCount(first)}–${formatCount(last)} of ${formatCount(totalRows)}`}
      </p>

      <div className="pagination__controls">
        <label className="pagination__size">
          <span className="muted small">Rows</span>
          <select
            className="input select"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="pagination__pager">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onPageChange(0)}
            disabled={page === 0}
            aria-label="First page"
          >
            «
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="pagination__position">
            Page {formatCount(pageCount === 0 ? 0 : page + 1)} of {formatCount(pageCount)}
          </span>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onPageChange(page + 1)}
            disabled={page + 1 >= pageCount}
            aria-label="Next page"
          >
            ›
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onPageChange(pageCount - 1)}
            disabled={page + 1 >= pageCount}
            aria-label="Last page"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
