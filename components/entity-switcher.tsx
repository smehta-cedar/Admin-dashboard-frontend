"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";

type SwitcherOption = { id: string; name: string; status: "active" | "inactive" };

type EntitySwitcherProps = {
  /** The select's label, e.g. "Switch agent". */
  label: string;
  currentId: string;
  /** Every entity, in any order: sorted by name here, so a rename never leaves it stale. */
  options: SwitcherOption[];
  /** The profile URL for an option's ID. */
  hrefFor: (id: string) => string;
};

/** Jumps from one profile to another of the same entity. Inactive ones are grouped last. */
export function EntitySwitcher({ label, currentId, options, hrefFor }: EntitySwitcherProps) {
  const router = useRouter();
  const selectId = useId();
  const sorted = [...options].sort((a, b) => a.name.localeCompare(b.name));
  const active = sorted.filter((option) => option.status === "active");
  const inactive = sorted.filter((option) => option.status !== "active");

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={selectId} className="text-sm font-medium text-fg-muted">
        {label}
      </label>
      <select
        id={selectId}
        value={currentId}
        onChange={(event) => router.push(hrefFor(event.target.value))}
        className="rounded-md border border-line-strong bg-surface py-1.5 pl-3 pr-8 text-sm text-fg focus:border-brand-strong focus:outline-none focus:ring-1 focus:ring-brand-strong"
      >
        <optgroup label="Active">
          {active.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </optgroup>
        {inactive.length > 0 ? (
          <optgroup label="Inactive">
            {inactive.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </div>
  );
}
