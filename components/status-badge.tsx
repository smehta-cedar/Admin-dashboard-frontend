type Status = "active" | "inactive";

const STATUS_STYLES: Record<Status, string> = {
  active: "bg-green-50 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}
