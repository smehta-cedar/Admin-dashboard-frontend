"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import type { CarrierRecord } from "@/lib/carriers";

type CarrierSwitcherProps = {
  currentId: string;
  /** Sorted by name. */
  carriers: Pick<CarrierRecord, "id" | "name" | "status">[];
};

/** Jumps to another carrier's profile. Inactive carriers are grouped last. */
export function CarrierSwitcher({ currentId, carriers }: CarrierSwitcherProps) {
  const router = useRouter();
  const selectId = useId();
  const active = carriers.filter((carrier) => carrier.status === "active");
  const inactive = carriers.filter((carrier) => carrier.status !== "active");

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={selectId} className="text-sm font-medium text-fg-muted">
        Switch carrier
      </label>
      <select
        id={selectId}
        value={currentId}
        onChange={(event) => router.push(`/carriers/${event.target.value}`)}
        className="rounded-md border border-line-strong bg-surface py-1.5 pl-3 pr-8 text-sm text-fg focus:border-brand-strong focus:outline-none focus:ring-1 focus:ring-brand-strong"
      >
        <optgroup label="Active">
          {active.map((carrier) => (
            <option key={carrier.id} value={carrier.id}>
              {carrier.name}
            </option>
          ))}
        </optgroup>
        {inactive.length > 0 ? (
          <optgroup label="Inactive">
            {inactive.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </div>
  );
}
