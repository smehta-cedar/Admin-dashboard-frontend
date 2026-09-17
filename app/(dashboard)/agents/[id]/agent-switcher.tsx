"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import type { AgentRecord } from "@/lib/agents";

type AgentSwitcherProps = {
  currentId: string;
  /** Sorted by name. */
  agents: Pick<AgentRecord, "id" | "name" | "status">[];
};

/** Jumps to another agent's profile. Inactive agents are grouped last. */
export function AgentSwitcher({ currentId, agents }: AgentSwitcherProps) {
  const router = useRouter();
  const selectId = useId();
  const active = agents.filter((agent) => agent.status === "active");
  const inactive = agents.filter((agent) => agent.status !== "active");

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={selectId} className="text-sm font-medium text-fg-muted">
        Switch agent
      </label>
      <select
        id={selectId}
        value={currentId}
        onChange={(event) => router.push(`/agents/${event.target.value}`)}
        className="rounded-md border border-line-strong bg-surface py-1.5 pl-3 pr-8 text-sm text-fg focus:border-brand-strong focus:outline-none focus:ring-1 focus:ring-brand-strong"
      >
        <optgroup label="Active">
          {active.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </optgroup>
        {inactive.length > 0 ? (
          <optgroup label="Inactive">
            {inactive.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </div>
  );
}
