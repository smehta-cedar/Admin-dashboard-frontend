"use client";

import type { AgentRecord } from "@/lib/agents";
import { byName } from "@/lib/text";

/*
 * The Agents boxes the agency's contract and licence dialogs share: tick
 * agents to give them the carrier or state in the same save. Agents that
 * already have it (`lockedIds`) show ticked and locked with `lockedLabel`;
 * inactive agents are left out unless locked. Select all / Clear all under
 * the list covers every agent that isn't locked.
 */

export type AgentOption = Pick<AgentRecord, "id" | "name" | "status">;

type AgentPickerProps = {
  id: string;
  agents: AgentOption[];
  /** Agents that already have it: ticked and locked. */
  lockedIds: Set<string>;
  /** Shown after a locked agent's name, e.g. "appointed". */
  lockedLabel: string;
  /** Ticked agents; may include locked ones, which the caller drops before saving. */
  selectedIds: string[];
  onChange: (agentIds: string[]) => void;
  error?: string | null;
  className?: string;
};

export function AgentPicker({
  id,
  agents,
  lockedIds,
  lockedLabel,
  selectedIds,
  onChange,
  error,
  className,
}: AgentPickerProps) {
  const options = agents.filter((agent) => agent.status !== "inactive" || lockedIds.has(agent.id)).sort(byName);
  const openIds = options.filter((agent) => !lockedIds.has(agent.id)).map((agent) => agent.id);
  const allTicked = openIds.length > 0 && openIds.every((agentId) => selectedIds.includes(agentId));

  return (
    <fieldset className={className} aria-describedby={error ? `${id}-agents-error` : undefined}>
      <legend className="text-sm font-medium text-fg">Agents</legend>
      {options.length === 0 ? (
        <p className="mt-2 text-sm text-fg-subtle">No agents yet.</p>
      ) : (
        <div className="mt-2 grid max-h-48 gap-x-4 gap-y-1.5 overflow-y-auto sm:grid-cols-2">
          {options.map((agent) => {
            const locked = lockedIds.has(agent.id);
            return (
              <label key={agent.id} className="flex items-center gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={locked || selectedIds.includes(agent.id)}
                  disabled={locked}
                  onChange={(event) => {
                    const { checked } = event.target;
                    onChange(
                      checked ? [...selectedIds, agent.id] : selectedIds.filter((agentId) => agentId !== agent.id),
                    );
                  }}
                  className="size-4 accent-brand-strong"
                />
                {agent.name}
                {locked ? (
                  <span className="text-fg-subtle"> ({lockedLabel})</span>
                ) : agent.status !== "active" ? (
                  <span className="text-fg-subtle"> ({agent.status})</span>
                ) : null}
              </label>
            );
          })}
        </div>
      )}
      {openIds.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange(allTicked ? [] : openIds)}
          className="mt-2 text-sm font-medium text-brand-ink hover:underline"
        >
          {allTicked ? "Clear all" : "Select all"}
        </button>
      ) : null}
      {error ? (
        <p id={`${id}-agents-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
