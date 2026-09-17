"use client";

import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type FilterFn,
  type RowData,
  type SortFn,
} from "@tanstack/react-table";
import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
import { TOOLBAR_INPUT_CLASS } from "@/components/classes";

/*
 * Shared list table: click a header to sort (asc → desc → original order), type
 * in the search box to narrow rows. TanStack Table (v9) only sorts and filters;
 * this component owns the markup (docs/entity-page-pattern.md §6–7), so cells
 * stay free to render links, badges, credential buttons and Edit.
 *
 * Display only: rows come from the view's state, and adds and edits in the view
 * show up here on the next render, in their sorted place.
 */

/** Passed to each cell so a name cell can toggle its details row. */
export type DataTableRowContext = {
  expanded: boolean;
  toggleExpanded: () => void;
  /** ID of the details row, for `aria-controls` while expanded. */
  detailsId: string;
};

export type DataTableColumn<T extends RowData> = {
  id: string;
  header: string;
  /** Visually hidden header, e.g. the actions column. */
  srOnlyHeader?: boolean;
  cell: (row: T, context: DataTableRowContext) => ReactNode;
  /** Classes for the `<td>`, added to the padding. */
  className?: string;
  /** Makes the column sortable. Numbers sort numerically; text ignores case and sorts "2" before "10". */
  sortValue?: (row: T) => string | number;
  /** Text the search box matches for this column. Leave out to keep a column unsearchable (e.g. passwords). */
  searchText?: (row: T) => string | string[];
};

type DataTableProps<T extends RowData> = {
  rows: T[];
  /** Keep this stable (module constant or `useMemo`): a new array re-derives the sort and filter. */
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  /** Singular and plural row noun: "Search agents", "3 of 12 agents". */
  unit: [string, string];
  /** Placeholder for the search box. Defaults to "Search <plural>…". */
  searchPlaceholder?: string;
  /** Content of a row's details row. Rows only expand through a cell calling `toggleExpanded`. */
  renderDetails?: (row: T) => ReactNode;
  /** Shown as one table row when `rows` is empty (not when a search hides everything). */
  emptyMessage?: ReactNode;
};

const SEARCH_COLUMN_ID = "__search";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
});

type Features = typeof features;

const collator = new Intl.Collator("en-US", { numeric: true, sensitivity: "base" });

const compareValues = (a: unknown, b: unknown) =>
  typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));

const sortRows = <T extends RowData>(): SortFn<Features, T> => (rowA, rowB, columnId) =>
  compareValues(rowA.getValue(columnId), rowB.getValue(columnId));

/** Every word in the query must appear somewhere in the row's searchable text. */
const matchesQuery = <T extends RowData>(): FilterFn<Features, T> => (row, columnId, query: string) => {
  const haystack = row.getValue<string>(columnId);
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
};

export function DataTable<T extends RowData>({
  rows,
  columns,
  getRowId,
  unit,
  searchPlaceholder,
  renderDetails,
  emptyMessage,
}: DataTableProps<T>) {
  const id = useId();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // TanStack only sees sortable columns plus one hidden column holding all the
  // searchable text, so a query can match words from different columns.
  const tableColumns = useMemo(() => {
    const defs: ColumnDef<Features, T>[] = columns.flatMap((column) => {
      const { sortValue } = column;
      return sortValue
        ? [{ id: column.id, accessorFn: sortValue, sortFn: sortRows<T>() }]
        : [];
    });
    const searchable = columns.flatMap((column) => (column.searchText ? [column.searchText] : []));
    defs.push({
      id: SEARCH_COLUMN_ID,
      accessorFn: (row) => searchable.flatMap((text) => text(row)).join("\n").toLowerCase(),
      enableSorting: false,
    });
    return defs;
  }, [columns]);

  const table = useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId: (row) => getRowId(row),
    sortDescFirst: false,
    enableMultiSort: false,
    globalFilterFn: matchesQuery<T>(),
    getColumnCanGlobalFilter: (column) => column.id === SEARCH_COLUMN_ID,
  });

  const query: string = table.state.globalFilter ?? "";
  const searching = query.trim() !== "";
  const visibleRows = table.getRowModel().rows;
  const colSpan = columns.length;
  const [singular, plural] = unit;

  const toggleExpanded = (rowId: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(rowId)) next.add(rowId);
      return next;
    });

  const clearSearch = () => table.setGlobalFilter("");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="relative w-full sm:w-72">
          <label htmlFor={`${id}-search`} className="sr-only">
            Search {plural}
          </label>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-faint"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13 13l3.5 3.5" />
          </svg>
          <input
            id={`${id}-search`}
            type="search"
            value={query}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                clearSearch();
              }
            }}
            placeholder={searchPlaceholder ?? `Search ${plural}…`}
            autoComplete="off"
            className={`${TOOLBAR_INPUT_CLASS} w-full pl-8`}
          />
        </div>
        <p aria-live="polite" className="text-sm tabular-nums text-fg-muted">
          {searching
            ? `${visibleRows.length} of ${rows.length} ${rows.length === 1 ? singular : plural}`
            : `${rows.length} ${rows.length === 1 ? singular : plural}`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-muted">
            <tr>
              {columns.map((column) => {
                if (column.srOnlyHeader) {
                  return (
                    <th key={column.id} scope="col" className="px-4 py-2.5">
                      <span className="sr-only">{column.header}</span>
                    </th>
                  );
                }
                const sortColumn = column.sortValue ? table.getColumn(column.id) : undefined;
                const sorted = sortColumn?.getIsSorted() ?? false;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    className="whitespace-nowrap px-4 py-2.5 font-medium text-fg-muted"
                  >
                    {sortColumn ? (
                      <button
                        type="button"
                        onClick={() => sortColumn.toggleSorting()}
                        className="-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
                      >
                        {column.header}
                        <SortIcon direction={sorted} />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-6 text-center text-fg-muted">
                  {searching ? (
                    <>
                      No {plural} match “{query.trim()}”.{" "}
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="rounded-md font-medium text-brand-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand"
                      >
                        Clear search
                      </button>
                    </>
                  ) : (
                    (emptyMessage ?? `No ${plural}.`)
                  )}
                </td>
              </tr>
            ) : null}
            {visibleRows.map((row) => {
              const expanded = renderDetails !== undefined && expandedIds.has(row.id);
              const context: DataTableRowContext = {
                expanded,
                toggleExpanded: () => toggleExpanded(row.id),
                detailsId: `${id}-details-${row.id}`,
              };

              return (
                <Fragment key={row.id}>
                  <tr className={expanded ? "bg-surface-muted" : undefined}>
                    {columns.map((column) => (
                      <td key={column.id} className={`px-4 py-2.5 ${column.className ?? ""}`}>
                        {column.cell(row.original, context)}
                      </td>
                    ))}
                  </tr>
                  {expanded && renderDetails ? (
                    <tr id={context.detailsId} className="bg-surface-muted">
                      <td colSpan={colSpan} className="px-4 pb-4 pt-1">
                        {renderDetails(row.original)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Up/down arrows: both faint when unsorted; the active one in brand ink when sorted. */
function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  const arrowClass = (arrow: "asc" | "desc") =>
    direction === arrow ? "text-brand-ink" : direction ? "text-fg-faint/50" : "text-fg-faint";
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 8L10 4.5 13.5 8" className={arrowClass("asc")} />
      <path d="M6.5 12L10 15.5 13.5 12" className={arrowClass("desc")} />
    </svg>
  );
}
