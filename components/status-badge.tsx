/**
 * Every status a badge can show. Agents use active, onboarding, sdr and inactive; carriers add
 * applied, pending and expired; passwords add pending; state licences add
 * applied, expired and cancelled.
 */
export type Status =
  | "active"
  | "onboarding"
  | "sdr"
  | "pending"
  | "applied"
  | "expired"
  | "cancelled"
  | "inactive";

const STATUS_STYLES: Record<Status, string> = {
  /* Brand-adjacent green; still reads as "good". */
  active: "bg-brand-soft text-brand-ink",
  /* Blue: getting set up, on the way to active. */
  onboarding: "bg-info-soft text-info-ink",
  /* Neutral outline: a role (sales development rep), not a stage. */
  sdr: "bg-surface-muted text-fg-muted ring-1 ring-inset ring-line-strong",
  pending: "bg-warn-soft text-warn-ink",
  /* Blue: sent in, waiting on the state. */
  applied: "bg-info-soft text-info-ink",
  /* Red: the licence has lapsed and needs attention. */
  expired: "bg-danger-soft text-danger-ink",
  /* Neutral outline: gone for good, nothing to do. */
  cancelled: "bg-surface-muted text-fg-muted ring-1 ring-inset ring-line-strong",
  inactive: "bg-surface-hover text-fg-muted",
};

/** What the badge says; the status itself, capitalized, except SDR stays an acronym. */
const STATUS_LABELS: Partial<Record<Status, string>> = { sdr: "SDR" };

/** The status as a badge or a dropdown option shows it: "Active", "SDR". */
export const statusLabel = (status: Status) =>
  STATUS_LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);

/** Sort order for status columns: active first, then the in-progress ones, then the ended ones. */
export const statusRank = (status: Status) =>
  ["active", "onboarding", "sdr", "pending", "applied", "expired", "cancelled", "inactive"].indexOf(status);

/** `renewing` adds a muted "Renewing" after the badge: a licence renewal is under way, whatever the status. */
export function StatusBadge({ status, renewing = false }: { status: Status; renewing?: boolean }) {
  const badge = (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {statusLabel(status)}
    </span>
  );
  if (!renewing) return badge;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {badge}
      <span className="text-xs text-fg-subtle">Renewing</span>
    </span>
  );
}
