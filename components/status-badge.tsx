/**
 * Every status a badge can show. Agents and carriers use active/inactive;
 * passwords add pending; agent state licences add review and jit.
 */
type Status = "active" | "review" | "pending" | "jit" | "inactive";

const STATUS_STYLES: Record<Status, string> = {
  /* Brand-adjacent green; still reads as "good". */
  active: "bg-brand-soft text-brand-ink",
  /* Blue: being looked at, nothing to do yet. */
  review: "bg-info-soft text-info-ink",
  pending: "bg-warn-soft text-warn-ink",
  /* Neutral outline: a mode ("just in time"), not a stage. */
  jit: "bg-surface-muted text-fg-muted ring-1 ring-inset ring-line-strong",
  inactive: "bg-surface-hover text-fg-muted",
};

/** What the badge says; the status itself, capitalized, except JIT stays an acronym. */
const STATUS_LABELS: Partial<Record<Status, string>> = { jit: "JIT" };

/** Sort order for status columns: active, then review, pending, jit, then inactive. */
export const statusRank = (status: Status) =>
  ["active", "review", "pending", "jit", "inactive"].indexOf(status);

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
