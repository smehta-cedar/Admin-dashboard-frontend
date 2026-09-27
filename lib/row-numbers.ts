/*
 * The number a record is shown with on a list page: its place in the
 * name-sorted list, 1…n. The API's IDs are UUIDs, which only appear in
 * profile URLs. A row number, not a key: it moves when a name sorts
 * elsewhere. Client-safe, so a list view can compute it from its live state.
 */

/** Record ID -> 1-based position in `rows` (pass them in display order). */
export function rowNumbers(rows: readonly { id: string }[]): Map<string, number> {
  return new Map(rows.map((row, index) => [row.id, index + 1]));
}
