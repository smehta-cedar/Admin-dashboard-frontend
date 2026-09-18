type UnsavedBannerProps = {
  /** Adds and edits made since the page loaded. Nothing renders at 0. */
  count: number;
  /** Margin to the neighbouring content: `mb-4` on list pages, `mt-4` on profiles. */
  className?: string;
};

/**
 * The §9 unsaved banner: every view keeps its records in component state
 * only, so this says how many changes a refresh would undo. Always rendered
 * inside a `role="status"` region, so the count is announced as it changes.
 */
export function UnsavedBanner({ count, className = "mb-4" }: UnsavedBannerProps) {
  return (
    <div role="status">
      {count > 0 ? (
        <p className={`rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink ${className}`}>
          {count === 1 ? "1 change" : `${count} changes`} made on this page only. Nothing is
          saved yet, so refreshing (or leaving the page) undoes {count === 1 ? "it" : "them"}.
        </p>
      ) : null}
    </div>
  );
}
