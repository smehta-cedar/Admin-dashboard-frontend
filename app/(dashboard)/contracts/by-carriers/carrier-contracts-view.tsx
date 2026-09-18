"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { UnsavedBanner } from "@/components/unsaved-banner";
import type { AgentRecord } from "@/lib/agents";
import type { CarrierContractNote, CarrierContractRecord } from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import { LINES_OF_BUSINESS } from "@/lib/lines-of-business";
import { stateSummary, writableStates } from "@/lib/us-states";
import { byName, initials } from "@/lib/text";
import { AppointmentDialog } from "../appointment-dialog";
import { useAppointments } from "../use-appointments";
import { AgentCarrierList } from "./agent-carrier-list";
import { AgentsPerCarrierChart } from "./agents-per-carrier-chart";

/*
 * A bar chart of active agents per carrier, grouped by line of business, sits
 * above one grid of square cards, one per carrier. Cards are only carriers
 * with at least one agent contracted, tagged with every line they write, with
 * an n/total count above a red-to-green coverage bar along the bottom edge.
 * Coverage is shown by color and the agent count only, never named or
 * filtered on. "Show all carriers" adds one muted "Not yet contracted" list
 * below the grid for carriers with no contract at all, as compact chips with
 * Add agent, never as cards. The chart, cards and list follow the same toggle.
 * Add contract works either way, for any carrier.
 *
 * A contract has no status: a row means the agent is contracted. Inactive
 * agents follow the same rule as inactive carriers: their contracts are shown
 * (muted tile, "(inactive)" in the Agents list) and editable, but coverage —
 * the chart, the n/total and the bar — counts active agents only, since an
 * inactive agent can't write. Status is edited on the Agents page. A card
 * shows its contracted agents as initials (appointed states on hover) and
 * does not expand. The add-agent icon top-right opens Add contract for that
 * carrier.
 *
 * The states shown against a contract are the writable ones: the appointment
 * narrowed to the agent's licensedStates (Agents) and the carrier's
 * availableStates (Carriers). Empty means none yet, not every state. The
 * Agents list below shows each carrier chip with those states, and clicking
 * them opens Edit. Every add and edit opens the shared AppointmentDialog
 * (../appointment-dialog.tsx), the same one Contracts by state uses; its state
 * grid offers only the states the chosen agent and carrier share. Add and edit
 * are dummy: contracts and notes live in component state only, and a refresh
 * brings back the JSON.
 */

type AgentOption = Pick<AgentRecord, "id" | "name" | "status" | "licensedStates">;
type CarrierOption = Pick<
  CarrierRecord,
  "id" | "name" | "linesOfBusiness" | "status" | "availableStates"
>;

type CarrierContractsViewProps = {
  initialContracts: CarrierContractRecord[];
  initialNotes: CarrierContractNote[];
  agents: AgentOption[];
  carriers: CarrierOption[];
};

/**
 * Picks colors only; never shown as text. Full: every active agent contracted.
 * Partial: some. None: no active agent.
 */
type Coverage = "full" | "partial" | "none";

const COVERAGE_STYLES: Record<Coverage, { bar: string }> = {
  full: { bar: "bg-green-500" },
  partial: { bar: "bg-amber-400" },
  none: { bar: "bg-line-strong" },
};

const SECTION_HEADING_CLASS = "text-xs font-semibold uppercase tracking-wide text-fg-subtle";

/** Initials tiles on a card face; past this, a "+n" tile stands in for the rest. */
const MAX_FACE_AGENTS = 11;

const AGENT_TILE_CLASS =
  "grid size-8 place-items-center rounded-md text-[11px] font-semibold tracking-wide";

/** Contracted agents: a soft sage that echoes the coverage bar. */
const AGENT_COLOR_CLASS = "bg-agent-chip text-agent-chip-ink ring-1 ring-inset ring-agent-chip-line";

/** Inactive agents: contracted, but not coverage, so the tile is muted. */
const INACTIVE_AGENT_COLOR_CLASS = "bg-surface-muted text-fg-subtle ring-1 ring-inset ring-line";

/** Person with a plus. */
function AddAgentIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="8" cy="6.5" r="3" />
      <path d="M2.5 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 6v5M13.5 8.5h5" />
    </svg>
  );
}

export function CarrierContractsView({
  initialContracts,
  initialNotes,
  agents,
  carriers,
}: CarrierContractsViewProps) {
  const [unsavedCount, setUnsavedCount] = useState(0);
  // Notes are still written on add and edit; the by-state page shows them.
  const { contracts, editor, setEditor, saveContract, agentName, carrierName } = useAppointments({
    initialContracts,
    initialNotes,
    agents,
    carriers,
    onSaved: (values, nextContracts) => {
      setUnsavedCount((count) => count + 1);
      noticeIfHidden(
        values.carrierId,
        nextContracts,
        `${agentName(values.agentId)} saved at ${carrierName(values.carrierId)}.`,
      );
    },
  });
  // Off: only carriers with an agent contracted. On: every carrier.
  const [showAll, setShowAll] = useState(false);
  // Shown when a change lands on a carrier the toggle hides. Keyed by a
  // counter, so a second hidden change restarts the timer even with the same message.
  const [hiddenNotice, setHiddenNotice] = useState<{ key: number; message: string } | null>(null);
  const id = useId();

  const allAgents = [...agents].sort(byName);
  // Coverage is measured against these; inactive agents are listed but never counted.
  const activeAgents = allAgents.filter((agent) => agent.status === "active");

  /**
   * One carrier's contracted agents, given a set of contracts: how many known
   * agents (`contracted`, decides whether it gets a card) and how many of them
   * are active (`contractedActive`, the coverage).
   */
  const coverageOf = (carrierId: string, from: CarrierContractRecord[]) => {
    const contractedIds = new Set(
      from.filter((contract) => contract.carrierId === carrierId).map((contract) => contract.agentId),
    );
    const contracted = allAgents.filter((agent) => contractedIds.has(agent.id)).length;
    const contractedActive = activeAgents.filter((agent) => contractedIds.has(agent.id)).length;
    const coverage: Coverage =
      contractedActive === 0
        ? "none"
        : contractedActive === activeAgents.length
          ? "full"
          : "partial";
    return { coverage, contracted, contractedActive };
  };

  // The hidden-carrier notice clears itself after a few seconds.
  useEffect(() => {
    if (!hiddenNotice) return;
    const timeout = setTimeout(() => setHiddenNotice(null), 6000);
    return () => clearTimeout(timeout);
  }, [hiddenNotice]);

  // One card per carrier, sorted by name, with its known agents' contracts
  // sorted by agent name. Rebuilt from state on every render, so a change shows at once.
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const allRows = [...carriers].sort(byName).map((carrier) => {
    const { coverage, contracted, contractedActive } = coverageOf(carrier.id, contracts);
    const carrierContracts = contracts
      .filter((contract) => contract.carrierId === carrier.id)
      .flatMap((contract) => {
        const agent = agentsById.get(contract.agentId);
        return agent
          ? [
              {
                contract,
                agent: agent.name,
                inactive: agent.status === "inactive",
                states: writableStates(
                  contract.appointedStates,
                  agent.licensedStates,
                  carrier.availableStates,
                ),
              },
            ]
          : [];
      })
      .sort((a, b) => a.agent.localeCompare(b.agent));
    return { carrier, coverage, contracted, contractedActive, carrierContracts };
  });
  // The toggle decides which carriers are in scope.
  const rows = showAll ? allRows : allRows.filter((row) => row.contracted > 0);
  // The chart groups by line, in LINES_OF_BUSINESS order, skipping empty lines.
  const groups = LINES_OF_BUSINESS.map((line) => ({
    line,
    rows: rows.filter((row) => row.carrier.linesOfBusiness.includes(line)),
  })).filter((group) => group.rows.length > 0);
  // Cards are one per contracted carrier; zeros (Show all) go in a single muted list.
  const cards = rows.filter((row) => row.contracted > 0);
  const zeros = rows.filter((row) => row.contracted === 0);

  const changeShowAll = (next: boolean) => {
    setShowAll(next);
    setHiddenNotice(null);
  };

  /** Tells the user when a change moved a carrier out of view. */
  const noticeIfHidden = (carrierId: string, nextContracts: CarrierContractRecord[], message: string) => {
    if (showAll || coverageOf(carrierId, nextContracts).contracted > 0) return;
    const hint = "That carrier has no agents contracted now; turn on Show all carriers to see it.";
    setHiddenNotice((current) => ({ key: (current?.key ?? 0) + 1, message: `${message} ${hint}` }));
  };

  return (
    <>
      <PageHeader
        title="Contracts by carrier"
        actions={
          <>
            {carriers.length > 0 ? (
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-fg-muted hover:bg-surface-hover">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(event) => changeShowAll(event.target.checked)}
                  className="size-4 accent-brand-strong"
                />
                Show all carriers
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => setEditor({ mode: "add" })}
              className={PRIMARY_BUTTON_CLASS}
            >
              Add contract
            </button>
          </>
        }
      />

      <UnsavedBanner count={unsavedCount} />
      <div role="status">
        {hiddenNotice ? (
          <p key={hiddenNotice.key} className="mb-4 rounded-md bg-surface-muted px-3 py-2 text-sm text-fg-muted">
            {hiddenNotice.message}
          </p>
        ) : null}
      </div>

      {carriers.length === 0 ? (
        <EmptyState
          title="No carriers yet"
          description="Add carriers on the Carriers page to record contracts with them."
        />
      ) : (
        <>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-line px-4 py-6 text-center text-sm text-fg-muted">
              No carriers have an agent contracted yet. Turn on Show all carriers, or add a contract.
            </p>
          ) : (
            <>
              <AgentsPerCarrierChart
                total={activeAgents.length}
                scopeText={showAll ? "all carriers" : "contracted carriers"}
                groups={groups.map((group) => ({
                  line: group.line,
                  bars: group.rows.map((row) => ({
                    id: row.carrier.id,
                    name: row.carrier.name,
                    count: row.contractedActive,
                    barClass: COVERAGE_STYLES[row.coverage].bar,
                  })),
                }))}
              />
              {cards.length > 0 ? (
                <section aria-labelledby={`${id}-cards-title`}>
                  <h2
                    id={`${id}-cards-title`}
                    className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg"
                  >
                    Carriers
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium tabular-nums text-fg-muted">
                      {cards.length}
                    </span>
                  </h2>
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] items-start gap-4">
                    {cards.map(({ carrier, contractedActive, carrierContracts }) => {
                      const percent =
                        activeAgents.length === 0
                          ? 0
                          : Math.round((contractedActive / activeAgents.length) * 100);
                      const shown = carrierContracts.slice(0, MAX_FACE_AGENTS);
                      const hiddenCount = carrierContracts.length - shown.length;

                      return (
                        <li
                          key={carrier.id}
                          className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition-shadow hover:shadow-md"
                        >
                          <div className="flex min-h-56 flex-col gap-8 px-5 pt-6 pb-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-2">
                                <h3 className="flex max-w-full items-center gap-1">
                                  <Link
                                    href={`/carriers/${carrier.id}`}
                                    className="truncate font-semibold tracking-tight text-fg hover:underline"
                                  >
                                    {carrier.name}
                                  </Link>
                                  {carrier.status === "inactive" ? (
                                    <span className="shrink-0 text-xs font-normal text-fg-faint">inactive</span>
                                  ) : null}
                                </h3>
                                {carrier.linesOfBusiness.length > 0 ? (
                                  <ul
                                    aria-label={`Lines of business for ${carrier.name}`}
                                    className="flex flex-wrap gap-1"
                                  >
                                    {carrier.linesOfBusiness.map((line) => (
                                      <li
                                        key={line}
                                        className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[9px] font-medium text-fg-muted"
                                      >
                                        {line}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditor({ mode: "add", carrierId: carrier.id })}
                                aria-label={`Add agent to ${carrier.name}`}
                                title="Add agent"
                                className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink transition-colors hover:bg-brand-strong hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                              >
                                <AddAgentIcon className="size-4" />
                              </button>
                            </div>

                            {/* Initials only, full name on hover. */}
                            <ul
                              aria-label={`Agents contracted with ${carrier.name}`}
                              className="flex flex-1 flex-wrap content-start gap-1.5"
                            >
                              {shown.map(({ contract, agent, inactive, states }) => (
                                <li
                                  key={contract.id}
                                  title={`${agent}${inactive ? " (inactive)" : ""} · ${
                                    states.length > 0 ? states.join(", ") : "No states"
                                  }`}
                                  className={`${AGENT_TILE_CLASS} ${
                                    inactive ? INACTIVE_AGENT_COLOR_CLASS : AGENT_COLOR_CLASS
                                  }`}
                                >
                                  <span aria-hidden="true">{initials(agent)}</span>
                                  <span className="sr-only">
                                    {agent}
                                    {inactive ? " (inactive)" : ""}, {stateSummary(states)}
                                  </span>
                                </li>
                              ))}
                              {hiddenCount > 0 ? (
                                <li className={`${AGENT_TILE_CLASS} bg-surface-muted text-fg-subtle`}>
                                  <span aria-hidden="true">+{hiddenCount}</span>
                                  <span className="sr-only">and {hiddenCount} more</span>
                                </li>
                              ) : null}
                            </ul>

                            {/* Coverage: the gradient spans the track, gray hides the uncontracted share. */}
                            <div className="flex items-center gap-3">
                              {/* Coverage bar: left (no agents) to right (every active agent). */}
                              <div
                                aria-hidden="true"
                                className="bg-coverage-gradient relative h-1.5 flex-1 overflow-hidden rounded-full"
                              >
                                <div
                                  className="absolute inset-y-0 right-0 bg-surface-muted"
                                  style={{ width: `${100 - percent}%` }}
                                />
                              </div>
                              <p className="text-sm tabular-nums">
                                <span aria-hidden="true">
                                  <span className="font-semibold text-fg">{contractedActive}</span>
                                  <span className="text-fg-faint">/{activeAgents.length}</span>
                                </span>
                                <span className="sr-only">
                                  {contractedActive} of {activeAgents.length} active agents
                                </span>
                              </p>
                            </div>
                          </div>

                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {/* Show all only: carriers with no active agent, kept out of the card grid. */}
              {zeros.length > 0 ? (
                <div
                  className={`rounded-lg border border-dashed border-line-strong bg-surface-muted px-4 py-3 ${
                    cards.length > 0 ? "mt-4" : ""
                  }`}
                >
                  <h3 className={SECTION_HEADING_CLASS}>
                    Not yet contracted
                    <span className="ml-1.5 font-normal normal-case tracking-normal">
                      ({zeros.length})
                    </span>
                  </h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {zeros.map(({ carrier }) => (
                      <li
                        key={carrier.id}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pl-3 pr-1 text-sm text-fg-muted"
                      >
                        <Link href={`/carriers/${carrier.id}`} className="hover:underline">
                          {carrier.name}
                        </Link>
                        {carrier.status === "inactive" ? (
                          <span className="text-fg-faint"> (inactive)</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setEditor({ mode: "add", carrierId: carrier.id })}
                          className="rounded-full px-2 py-0.5 text-xs font-medium text-fg-muted hover:bg-surface-hover hover:text-fg"
                        >
                          <span aria-hidden="true">+ </span>Add agent
                          <span className="sr-only"> to {carrier.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <AgentCarrierList
                agents={allAgents}
                carriers={rows.map((row) => row.carrier)}
                contracts={contracts}
                headingId={`${id}-agents-title`}
                onAdd={(agentId) => setEditor({ mode: "add", agentId })}
                onEdit={(contract) => setEditor({ mode: "edit", contract })}
              />
            </>
          )}
        </>
      )}

      <AppointmentDialog
        editor={editor}
        agents={allAgents}
        carriers={carriers}
        onSave={saveContract}
        onClose={() => setEditor(null)}
      />
    </>
  );
}
