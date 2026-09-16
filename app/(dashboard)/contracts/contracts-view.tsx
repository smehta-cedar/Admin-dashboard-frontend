"use client";

import { useId, useMemo, useState } from "react";
import { INPUT_CLASS } from "@/components/classes";
import { PageHeader } from "@/components/page-header";
import { MAP_BUCKETS, UsMap } from "@/components/us-map";
import type { AgentRecord } from "@/lib/agents";
import type { ContractRecord } from "@/lib/contracts";
import { US_STATE_NAMES, US_STATES } from "@/lib/us-states";

/*
 * Contracts, phase 1: which agents are licensed in which states. A map colors
 * each state by how many agents hold an active license there; clicking a state
 * lists those agents. View only: no add, edit or notes yet, and carrier
 * contracts come in a later phase.
 */

type ContractsViewProps = {
  initialContracts: ContractRecord[];
  agents: AgentRecord[];
};

export function ContractsView({ initialContracts, agents }: ContractsViewProps) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const id = useId();

  // State code → agents with an active license there, sorted by name.
  const agentsByState = useMemo(() => {
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const byState = new Map<string, AgentRecord[]>();
    for (const contract of initialContracts) {
      if (contract.status !== "active") continue;
      const agent = agentsById.get(contract.agentId);
      if (!agent) continue;
      for (const code of new Set(contract.licensedStates)) {
        byState.set(code, [...(byState.get(code) ?? []), agent]);
      }
    }
    for (const list of byState.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return byState;
  }, [initialContracts, agents]);

  const counts = useMemo(
    () => Object.fromEntries([...agentsByState].map(([code, list]) => [code, list.length])),
    [agentsByState],
  );

  const licensedAgentCount = new Set([...agentsByState.values()].flat().map((agent) => agent.id)).size;
  const statesCovered = [...agentsByState.keys()].filter((code) => code in US_STATE_NAMES).length;

  const selectedAgents = selectedCode ? (agentsByState.get(selectedCode) ?? []) : [];
  const selectedName = selectedCode ? (US_STATE_NAMES[selectedCode] ?? selectedCode) : null;

  const stats = [
    { label: "Licensed agents", value: String(licensedAgentCount) },
    { label: "States covered", value: `${statesCovered} of ${US_STATES.length}` },
  ];

  return (
    <>
      <PageHeader
        title="Contracts"
      
      />

      <dl className="mb-6 flex flex-wrap divide-x divide-gray-200 rounded-lg border border-gray-200">
        {stats.map((stat) => (
          <div key={stat.label} className="px-4 py-3">
            <dt className="text-sm text-gray-600">{stat.label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby={`${id}-map-title`}>
          <h2 id={`${id}-map-title`} className="sr-only">
            Active agents by state
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 p-4">
            <div className="min-w-[36rem]">
              <UsMap
                counts={counts}
                selectedCode={selectedCode}
                onSelect={setSelectedCode}
                unit={["agent", "agents"]}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
            <span>Active agents licensed</span>
            <ul className="flex flex-wrap items-center gap-3">
              {MAP_BUCKETS.map((bucket) => (
                <li key={bucket.label} className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`size-3 rounded-sm ring-1 ring-inset ring-gray-900/10 ${bucket.swatch}`}
                  />
                  <span className="tabular-nums">{bucket.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby={`${id}-detail-title`} className="min-w-0">
          <label htmlFor={`${id}-state`} className="block text-sm font-medium text-gray-900">
            State
          </label>
          <select
            id={`${id}-state`}
            value={selectedCode ?? ""}
            onChange={(event) => setSelectedCode(event.target.value || null)}
            className={INPUT_CLASS}
          >
            <option value="">Choose a state…</option>
            {US_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>

          <div role="status" className="mt-4 rounded-lg border border-gray-200 p-4">
            {selectedName ? (
              <>
                <h2 id={`${id}-detail-title`} className="text-base font-semibold text-gray-900">
                  {selectedName}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {selectedAgents.length} active {selectedAgents.length === 1 ? "agent" : "agents"} licensed
                </p>
                {selectedAgents.length > 0 ? (
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {selectedAgents.map((agent) => (
                      <li key={agent.id}>
                        <span className="text-gray-900 underline decoration-gray-300 underline-offset-2">
                          {agent.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">No active agents are licensed in {selectedName}.</p>
                )}
              </>
            ) : (
              <>
                <h2 id={`${id}-detail-title`} className="text-base font-semibold text-gray-900">
                  No state selected
                </h2>
                <p className="mt-1 text-sm text-gray-600">Click a state on the map to see its licensed agents.</p>
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
