/**
 * Query-string key the navbar search hands a list page (`/agents?q=maria`);
 * `DataTable` filters on it.
 */
export const SEARCH_PARAM = "q";

/** A query's words, lower-cased. A row matches when its text holds every one. */
export const searchWords = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);

/** One record the navbar search can suggest while typing. */
export type SearchEntry = {
  /** Where picking it goes: the record's profile, or its list narrowed to it. */
  href: string;
  title: string;
  /** Second, muted line. */
  detail: string;
  /** Lower-cased text the query is matched against; the list table's `searchText`, joined. */
  text: string;
};

/** Entries per search scope, keyed by the scope's list href ("/agents"). */
export type SearchIndex = Record<string, SearchEntry[]>;
