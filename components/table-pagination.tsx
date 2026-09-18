"use client";

import { useEffect, useState } from "react";

/*
 * Shared client-side pagination for list and profile tables: default 5 rows,
 * with 10 and 20 options. The footer stays hidden while the list fits on one
 * default page.
 */

export const TABLE_PAGE_SIZES = [5, 10, 20] as const;
export type TablePageSize = (typeof TABLE_PAGE_SIZES)[number];

const PAGE_BUTTON_CLASS =
  "rounded px-1.5 py-0.5 text-fg-muted hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

type UseTablePaginationResult<T> = {
  pageItems: T[];
  start: number;
  pageSize: TablePageSize;
  setPageSize: (size: TablePageSize) => void;
  currentPage: number;
  pageCount: number;
  setPage: (page: number) => void;
};

/**
 * Slices `items` into pages. Pass `resetKey` (e.g. the search query) so the
 * page jumps back to 0 when the filtered set changes under you.
 */
export function useTablePagination<T>(
  items: T[],
  resetKey?: string | number,
): UseTablePaginationResult<T> {
  const [pageSize, setPageSizeState] = useState<TablePageSize>(5);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [resetKey]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return {
    pageItems,
    start,
    pageSize,
    setPageSize: (size) => {
      setPageSizeState(size);
      setPage(0);
    },
    currentPage,
    pageCount,
    setPage,
  };
}

type TablePaginationProps = {
  /** Inclusive 1-based start index of the current page. */
  start: number;
  /** How many rows are on the current page. */
  pageLength: number;
  total: number;
  pageSize: TablePageSize;
  onPageSizeChange: (size: TablePageSize) => void;
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

/** Minimal range + page-size + prev/next footer under a table. */
export function TablePagination({
  start,
  pageLength,
  total,
  pageSize,
  onPageSizeChange,
  currentPage,
  pageCount,
  onPageChange,
}: TablePaginationProps) {
  if (total <= TABLE_PAGE_SIZES[0]) return null;

  return (
    <nav
      aria-label="Table pages"
      className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs text-fg-muted"
    >
      <span className="tabular-nums" aria-live="polite">
        {start + 1}–{start + pageLength} of {total}
      </span>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span className="text-fg-subtle">Show</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value) as TablePageSize)}
            className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-fg focus:border-brand-strong focus:outline-none focus:ring-1 focus:ring-brand-strong"
          >
            {TABLE_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
            className={PAGE_BUTTON_CLASS}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="min-w-12 text-center tabular-nums">
            {currentPage + 1}/{pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= pageCount - 1}
            className={PAGE_BUTTON_CLASS}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      </div>
    </nav>
  );
}
