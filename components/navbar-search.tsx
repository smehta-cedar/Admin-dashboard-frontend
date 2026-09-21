"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { SEARCH_PARAM, searchWords, type SearchEntry, type SearchIndex } from "@/lib/search";
import type { NavItem } from "./sidebar";

/*
 * Navbar search: a scope select joined to the left of the search box. The
 * scopes are the sidebar links marked `searchable`; submitting opens that page
 * with `?q=`, which its `DataTable` picks up as the table search. While the
 * scope's own list is on screen, `?q=` is rewritten on every keystroke instead,
 * so the table filters as you type with no trip to the server.
 *
 * On every page the box also drops a list of the scope's matching records as
 * you type (a combobox: arrows move, Enter picks, Escape closes). Picking one
 * opens its profile, or its list narrowed to that row where there is no
 * profile. The records come from `index`, built on the server by
 * lib/search-index.ts with the layout, so it is as fresh as the last full
 * load or `router.refresh()`.
 */

/** Suggestions shown at once; "See all" opens the list for the rest. */
const MAX_RESULTS = 6;

type NavbarSearchProps = {
  /** Sidebar links whose page has a searchable table. */
  scopes: NavItem[];
  /** Records to suggest, per scope href. */
  index: SearchIndex;
  className?: string;
};

export function NavbarSearch({ scopes, index, className = "" }: NavbarSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Dashboard routes render per request, so ?q= is known on the server too.
  const urlQuery = useSearchParams().get(SEARCH_PARAM) ?? "";
  const [query, setQuery] = useState(urlQuery);

  // ?q= changed from outside the box: the table's "Clear search", back/forward,
  // or a move to another page. Skipped while typing, when the URL trails the box.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setQuery(urlQuery);
  }, [urlQuery]);
  // Null follows the page being viewed (Agents on /agents/3); a pick from the
  // select holds until the search is sent.
  const [pickedHref, setPickedHref] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  /** Highlighted suggestion; -1 leaves Enter to the plain search. */
  const [activeIndex, setActiveIndex] = useState(-1);

  const currentScope = scopes.find(
    (scope) => pathname === scope.href || pathname.startsWith(`${scope.href}/`),
  );
  const scopeHref = pickedHref ?? currentScope?.href ?? scopes[0]?.href ?? "";

  // Same rule as the table: every word typed appears somewhere in the record.
  const matches = useMemo(() => {
    const words = searchWords(query);
    if (words.length === 0) return [];
    return (index[scopeHref] ?? []).filter((entry) => words.every((word) => entry.text.includes(word)));
  }, [index, scopeHref, query]);

  if (scopes.length === 0) return null;

  const scopeLabel = scopes.find((scope) => scope.href === scopeHref)?.label ?? "";

  // The scope's list page is the one on screen, so its table can follow ?q= live.
  const onListPage = pathname === scopeHref;

  // replaceState reaches the table through useSearchParams without the server
  // render a router navigation would wait for. Other params (?carrier=) stay.
  const writeQuery = (text: string) => {
    const params = new URLSearchParams(window.location.search);
    if (text) params.set(SEARCH_PARAM, text);
    else params.delete(SEARCH_PARAM);
    const rest = params.toString();
    window.history.replaceState(null, "", rest ? `?${rest}` : window.location.pathname);
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    setOpen(true);
    setActiveIndex(-1);
    if (onListPage) writeQuery(value.trim());
  };

  /** The plain search: every match, in the scope's table. */
  const openList = () => {
    const text = query.trim();
    if (onListPage) writeQuery(text);
    else router.push(text ? `${scopeHref}?${SEARCH_PARAM}=${encodeURIComponent(text)}` : scopeHref);
    setPickedHref(null);
    setOpen(false);
  };

  const pick = (entry: SearchEntry) => {
    // The box follows where it leads: the row's own words, or empty on a profile.
    setQuery(new URL(entry.href, window.location.origin).searchParams.get(SEARCH_PARAM) ?? "");
    setPickedHref(null);
    setOpen(false);
    router.push(entry.href);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    openList();
  };

  const shown = matches.slice(0, MAX_RESULTS);
  // On the list page the table under the box already shows every match; a
  // single match has nothing more to see.
  const seeAll = !onListPage && matches.length > 1;
  const optionCount = shown.length + (seeAll ? 1 : 0);
  const listOpen = open && query.trim() !== "";
  const active = activeIndex < optionCount ? activeIndex : -1;
  const listId = `${id}-results`;
  const optionId = (position: number) => `${id}-result-${position}`;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!listOpen) setOpen(true);
      else if (optionCount > 0) {
        const step = event.key === "ArrowDown" ? 1 : -1;
        // From nothing highlighted, Down lands on the first and Up on the last.
        setActiveIndex(
          active === -1 && step === -1 ? optionCount - 1 : (active + step + optionCount) % optionCount,
        );
      }
    } else if (event.key === "Enter" && listOpen && active !== -1) {
      event.preventDefault();
      if (active < shown.length) pick(shown[active]);
      else openList();
    } else if (event.key === "Escape") {
      // First Escape closes the list, the next clears the box.
      if (listOpen) {
        event.preventDefault();
        setOpen(false);
      } else if (query) {
        event.preventDefault();
        changeQuery("");
        setOpen(false);
      }
    }
  };

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      // Focus left the whole control, not just moved between its parts.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      className={`relative items-stretch rounded-md border border-line-strong bg-surface focus-within:border-brand-strong focus-within:ring-1 focus-within:ring-brand-strong ${className}`}
    >
      <label htmlFor={`${id}-scope`} className="sr-only">
        Search in
      </label>
      <select
        id={`${id}-scope`}
        value={scopeHref}
        onChange={(event) => {
          setPickedHref(event.target.value);
          setActiveIndex(-1);
        }}
        className="shrink-0 rounded-l-md border-r border-line bg-surface-muted py-1 pl-2.5 pr-1 text-sm font-medium text-fg-muted hover:text-fg focus:outline-none"
      >
        {scopes.map((scope) => (
          <option key={scope.href} value={scope.href}>
            {scope.label}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-query`} className="sr-only">
        Search {scopeLabel.toLowerCase()}
      </label>
      <input
        id={`${id}-query`}
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => changeQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listOpen ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={listOpen && active !== -1 ? optionId(active) : undefined}
        placeholder={`Search ${scopeLabel.toLowerCase()}…`}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent px-2.5 py-1 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Search"
        title="Search"
        className="shrink-0 rounded-r-md px-2 text-fg-subtle hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <circle cx="9" cy="9" r="5.5" />
          <path d="M13 13l3.5 3.5" />
        </svg>
      </button>
      {listOpen ? (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          {optionCount > 0 ? (
            <ul id={listId} role="listbox" aria-label={`Matching ${scopeLabel.toLowerCase()}`} className="py-1">
              {shown.map((entry, position) => (
                <li
                  key={`${entry.href} ${position}`}
                  id={optionId(position)}
                  role="option"
                  aria-selected={position === active}
                  // Keeps focus in the box, so the list is still open for the click.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(position)}
                  onClick={() => pick(entry)}
                  className={`cursor-pointer px-3 py-1.5 ${position === active ? "bg-surface-hover" : ""}`}
                >
                  <p className="truncate text-sm text-fg">{entry.title}</p>
                  {entry.detail ? <p className="truncate text-xs text-fg-muted">{entry.detail}</p> : null}
                </li>
              ))}
              {seeAll ? (
                <li
                  id={optionId(shown.length)}
                  role="option"
                  aria-selected={active === shown.length}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(shown.length)}
                  onClick={openList}
                  className={`cursor-pointer border-t border-line px-3 py-2 text-sm font-medium text-brand-ink ${
                    active === shown.length ? "bg-surface-hover" : ""
                  }`}
                >
                  See all {matches.length} in {scopeLabel}
                </li>
              ) : null}
            </ul>
          ) : (
            <p role="status" className="px-3 py-2.5 text-sm text-fg-muted">
              No {scopeLabel.toLowerCase()} match “{query.trim()}”.
            </p>
          )}
        </div>
      ) : null}
    </form>
  );
}
