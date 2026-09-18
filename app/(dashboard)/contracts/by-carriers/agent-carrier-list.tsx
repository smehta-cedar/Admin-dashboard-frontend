import Link from "next/link";
import { stateSummary, writableStates } from "@/lib/us-states";
import { initials } from "@/lib/text";

/*
 * Contracts grouped by agent, as one plain row per agent: initials and name,
 * how many carriers they are contracted with (count as text plus a thin bar
 * out of the carriers shown above), and those carriers as name chips, each
 * with the states the agent can write there: the appointment narrowed to their
 * licences and the carrier's footprint. Clicking the states opens Edit for that
 * contract.
 * Carriers in scope are the same ones the cards above show, so "Show all
 * carriers" applies here too. Agents with no contract stay listed, muted, so
 * gaps are visible; inactive agents are listed too, marked "(inactive)". Add
 * carrier opens Add contract for that agent.
 */

type ListAgent = { id: string; name: string; status: "active" | "inactive"; licensedStates: string[] };
type ListCarrier = { id: string; name: string; availableStates: string[] };
type ListContract = { id: string; agentId: string; carrierId: string; appointedStates: string[] };

type AgentCarrierListProps = {
  /** Every agent, sorted by name. */
  agents: ListAgent[];
  /** Carriers in scope, in display order. */
  carriers: ListCarrier[];
  contracts: ListContract[];
  onAdd: (agentId: string) => void;
  onEdit: (contract: ListContract) => void;
  headingId: string;
};

export function AgentCarrierList({ agents, carriers, contracts, onAdd, onEdit, headingId }: AgentCarrierListProps) {
  const total = carriers.length;

  return (
    <section aria-labelledby={headingId} className="mt-10">
      <h2 id={headingId} className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
        Agents
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium tabular-nums text-fg-muted">
          {agents.length}
        </span>
      </h2>

      {agents.length === 0 ? (
        <p className="rounded-lg border border-line px-4 py-6 text-center text-sm text-fg-muted">
          No agents yet. Add them on the Agents page.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
          {agents.map((agent) => {
            // In the order of the carriers shown above, each with its contract.
            const agentCarriers = carriers.flatMap((carrier) => {
              const contract = contracts.find(
                (item) => item.agentId === agent.id && item.carrierId === carrier.id,
              );
              return contract ? [{ carrier, contract }] : [];
            });
            const count = agentCarriers.length;
            const percent = total === 0 ? 0 : Math.round((count / total) * 100);

            return (
              <li
                key={agent.id}
                className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-carrier-soft/60 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="flex items-center gap-3 sm:w-60 sm:shrink-0">
                  <span
                    aria-hidden="true"
                    className={`grid size-9 shrink-0 place-items-center rounded-md text-xs font-semibold tracking-wide ${
                      count > 0
                        ? "bg-carrier-soft text-carrier-chip-ink ring-1 ring-inset ring-carrier-chip-line"
                        : "bg-carrier-soft text-carrier-chip-faint ring-1 ring-inset ring-carrier-soft"
                    }`}
                  >
                    {initials(agent.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fg">
                      <Link href={`/agents/${agent.id}`} className="hover:underline">
                        {agent.name}
                      </Link>
                      {agent.status === "inactive" ? (
                        <span className="font-normal text-fg-faint"> (inactive)</span>
                      ) : null}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <div aria-hidden="true" className="h-1.5 w-20 overflow-hidden rounded-full bg-carrier-soft">
                        <div className="h-full rounded-full bg-carrier-chip-faint" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-fg-subtle">
                        {count} of {total} {total === 1 ? "carrier" : "carriers"}
                      </span>
                    </div>
                  </div>
                </div>

                {count > 0 ? (
                  <ul aria-label={`Carriers ${agent.name} is contracted with`} className="flex flex-1 flex-wrap gap-1.5">
                    {agentCarriers.map(({ carrier, contract }) => {
                      const states = writableStates(
                        contract.appointedStates,
                        agent.licensedStates,
                        carrier.availableStates,
                      );
                      return (
                        <li
                          key={carrier.id}
                          className="flex items-stretch divide-x divide-carrier-chip-line rounded-md bg-carrier-chip text-xs font-medium text-carrier-chip-ink ring-1 ring-inset ring-carrier-chip-line"
                        >
                          <Link href={`/carriers/${carrier.id}`} className="block px-2 py-1 hover:underline">
                            {carrier.name}
                          </Link>
                          <button
                            type="button"
                            onClick={() => onEdit(contract)}
                            title={states.length > 0 ? states.join(", ") : "No states yet"}
                            className={`rounded-r-md px-2 py-1 tabular-nums hover:bg-carrier-chip-line/60 ${
                              states.length === 0 ? "text-carrier-chip-faint" : "text-carrier-chip-muted"
                            }`}
                          >
                            {stateSummary(states)}
                            <span className="sr-only">
                              {" "}
                              for {agent.name} at {carrier.name}. Edit
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="flex-1 text-sm text-carrier-chip-faint">No carriers yet</p>
                )}

                <button
                  type="button"
                  onClick={() => onAdd(agent.id)}
                  className="self-start rounded-md px-2 py-1 text-sm font-medium text-carrier-chip-muted hover:bg-carrier-soft hover:text-fg sm:self-center"
                >
                  <span aria-hidden="true">+ </span>Add carrier
                  <span className="sr-only"> for {agent.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
