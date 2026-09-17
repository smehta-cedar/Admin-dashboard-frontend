/** Every status a badge can show. Agents and carriers use active/inactive; logins add pending. */
type Status = "active" | "pending" | "inactive";

const STATUS_STYLES: Record<Status, string> = {
  /* Brand-adjacent green; still reads as "good". */
  active: "bg-brand-soft text-brand-ink",
  pending: "bg-warn-soft text-warn-ink",
  inactive: "bg-surface-hover text-fg-muted",
};

/** Sort order for status columns: active, then pending, then inactive. */
export const statusRank = (status: Status) => ["active", "pending", "inactive"].indexOf(status);

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}
