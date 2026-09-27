/**
 * Every status a badge can show. Agents and carriers use active/inactive;
 * passwords add pending; state licences add review, applied, expired,
 * cancelled and jit.
 */
type Status = "active" | "review" | "pending" | "applied" | "expired" | "cancelled" | "jit" | "inactive";

const STATUS_STYLES: Record<Status, string> = {
  /* Brand-adjacent green; still reads as "good". */
  active: "bg-brand-soft text-brand-ink",
  /* Blue: being looked at, nothing to do yet. */
  review: "bg-info-soft text-info-ink",
  pending: "bg-warn-soft text-warn-ink",
  /* Blue like review: sent in, waiting on the state. */
  applied: "bg-info-soft text-info-ink",
  /* Red: the licence has lapsed and needs attention. */
  expired: "bg-danger-soft text-danger-ink",
  /* Neutral outline: gone for good, nothing to do. */
  cancelled: "bg-surface-muted text-fg-muted ring-1 ring-inset ring-line-strong",
  /* Neutral outline: a mode ("just in time"), not a stage. */
  jit: "bg-surface-muted text-fg-muted ring-1 ring-inset ring-line-strong",
  inactive: "bg-surface-hover text-fg-muted",
};

/** What the badge says; the status itself, capitalized, except JIT stays an acronym. */
const STATUS_LABELS: Partial<Record<Status, string>> = { jit: "JIT" };

/** The status as a badge or a dropdown option shows it: "Active", "JIT". */
export const statusLabel = (status: Status) =>
  STATUS_LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);

/** Sort order for status columns: active first, then the in-progress ones, then the ended ones. */
export const statusRank = (status: Status) =>
  ["active", "review", "pending", "applied", "jit", "expired", "cancelled", "inactive"].indexOf(status);

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {statusLabel(status)}
    </span>
  );
}
