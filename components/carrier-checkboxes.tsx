"use client";

type CarrierCheckboxesProps = {
  /** Heading above the boxes; names the group. */
  legend: string;
  /** The carriers to offer, in the order shown. */
  carriers: { id: string; name: string }[];
  /** IDs of the checked carriers. */
  checkedIds: string[];
  /** Runs on every change with the checked IDs. */
  onChange: (checkedIds: string[]) => void;
  /** Shown instead of the boxes when there are no carriers to offer. */
  emptyText: string;
  /** An error for the group, shown below the boxes. */
  error?: string | null;
  /** Id for the error, so the group can point at it. */
  errorId: string;
  className?: string;
};

/**
 * Fieldset of carrier checkboxes in two columns, controlled by the caller.
 * Used for the carriers a policy type requires certification for and the
 * carriers a certification covers.
 */
export function CarrierCheckboxes({
  legend,
  carriers,
  checkedIds,
  onChange,
  emptyText,
  error,
  errorId,
  className,
}: CarrierCheckboxesProps) {
  return (
    <fieldset className={className} aria-describedby={error ? errorId : undefined}>
      <legend className="text-sm font-medium text-fg">{legend}</legend>
      {carriers.length === 0 ? (
        <p className="mt-2 text-sm text-fg-subtle">{emptyText}</p>
      ) : (
        <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {carriers.map((carrier) => (
            <label key={carrier.id} className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={checkedIds.includes(carrier.id)}
                onChange={(event) => {
                  const { checked } = event.target;
                  onChange(
                    checked ? [...checkedIds, carrier.id] : checkedIds.filter((carrierId) => carrierId !== carrier.id),
                  );
                }}
                aria-invalid={error ? true : undefined}
                className="size-4 accent-brand-strong"
              />
              {carrier.name}
            </label>
          ))}
        </div>
      )}
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
