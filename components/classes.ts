/**
 * Shared Tailwind class strings (docs/entity-page-pattern.md §10).
 *
 * Built only from the semantic tokens in app/globals.css, so they follow the
 * theme without a `dark:` variant anywhere.
 */

export const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg focus:border-brand-strong focus:outline-none focus:ring-1 focus:ring-brand-strong aria-invalid:border-danger-strong";

export const PRIMARY_BUTTON_CLASS =
  "rounded-md bg-brand-strong px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export const GHOST_BUTTON_CLASS =
  "rounded-md px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-hover hover:text-fg";

export const ROW_BUTTON_CLASS =
  "rounded-md px-2 py-1 text-sm font-medium text-fg-muted hover:bg-surface-hover hover:text-fg";

/** INPUT_CLASS without the top margin and full width, for search boxes and filters above a table. */
export const TOOLBAR_INPUT_CLASS =
  "block rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg focus:border-brand-strong focus:outline-none focus:ring-1 focus:ring-brand-strong";
