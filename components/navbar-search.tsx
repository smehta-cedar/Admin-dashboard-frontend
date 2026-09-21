"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { SEARCH_PARAM } from "@/lib/search";
import type { NavItem } from "./sidebar";

/*
 * Navbar search: a scope select joined to the left of the search box. The
 * scopes are the sidebar links marked `searchable`; submitting opens that page
 * with `?q=`, which its `DataTable` picks up as the table search. While the
 * scope's own list is on screen, `?q=` is rewritten on every keystroke instead,
 * so the table filters as you type with no trip to the server.
 */

type NavbarSearchProps = {
  /** Sidebar links whose page has a searchable table. */
  scopes: NavItem[];
  className?: string;
};

export function NavbarSearch({ scopes, className = "" }: NavbarSearchProps) {
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

  if (scopes.length === 0) return null;

  const currentScope = scopes.find(
    (scope) => pathname === scope.href || pathname.startsWith(`${scope.href}/`),
  );
  const scopeHref = pickedHref ?? currentScope?.href ?? scopes[0].href;
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
    if (onListPage) writeQuery(value.trim());
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = query.trim();
    if (onListPage) writeQuery(text);
    else router.push(text ? `${scopeHref}?${SEARCH_PARAM}=${encodeURIComponent(text)}` : scopeHref);
    setPickedHref(null);
  };

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={`items-stretch rounded-md border border-line-strong bg-surface focus-within:border-brand-strong focus-within:ring-1 focus-within:ring-brand-strong ${className}`}
    >
      <label htmlFor={`${id}-scope`} className="sr-only">
        Search in
      </label>
      <select
        id={`${id}-scope`}
        value={scopeHref}
        onChange={(event) => setPickedHref(event.target.value)}
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
        onKeyDown={(event) => {
          if (event.key === "Escape" && query) {
            event.preventDefault();
            changeQuery("");
          }
        }}
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
    </form>
  );
}
