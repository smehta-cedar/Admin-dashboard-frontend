"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { PageHeader } from "@/components/page-header";
import type { AgentRecord } from "@/lib/agents";
import type {
  CarrierContractField,
  CarrierContractNote,
  CarrierContractRecord,
} from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import { diffValues, nextId } from "@/lib/change-notes";
import { LINES_OF_BUSINESS } from "@/lib/lines-of-business";
import { AgentsPerCarrierChart } from "./agents-per-carrier-chart";

/*
 * A bar chart of active agents per carrier, grouped by line of business, sits
 * above one grid of square cards, one per carrier. Cards are only carriers
 * with at least one active agent contracted, tagged with every line they
 * write, with an n/total count above a red-to-green coverage bar along the
 * bottom edge. Coverage is shown by color and the agent count only, never named or
 * filtered on. "Show all carriers" adds one muted "Not yet contracted" list
 * below the grid for carriers with no active agent, as compact chips with Add
 * agent, never as cards. The chart, cards and list follow the same toggle.
 * Add contract works either way, for any carrier.
 *
 * A contract has no status: a row means the agent is contracted. Only active
 * agents appear: `agents` holds active agents only (status is edited on the
 * Agents page), and a contract for any other agent stays in state but is never
 * shown or counted, ready for when that agent is active again. A card shows
 * its contracted agents as initials and does not expand; editing, removing and
 * notes will live on the carrier profile. The add-agent icon top-right opens
 * Add contract for that carrier. Add is dummy: contracts and notes live in
 * component state only, and a refresh brings back the JSON.
 */

/** An active agent. Inactive agents are never passed in. */
type AgentOption = Pick<AgentRecord, "id" | "name">;
type CarrierOption = Pick<CarrierRecord, "id" | "name" | "linesOfBusiness" | "status">;

type CarrierContractsViewProps = {
  initialContracts: CarrierContractRecord[];
  initialNotes: CarrierContractNote[];
  agents: AgentOption[];
  carriers: CarrierOption[];
};

/**
 * Which dialog is open. Add may start on a carrier (from that carrier's card);
 * edit holds the contract as it was when the dialog opened.
 */
type Editor = { mode: "add"; carrierId: string } | { mode: "edit"; contract: CarrierContractRecord };

type ContractValues = Omit<CarrierContractRecord, "id">;

/**
 * Picks colors only; never shown as text. Full: every active agent contracted.
 * Partial: some. None: no active agent.
 */
type Coverage = "full" | "partial" | "none";

/** Also the order changes are compared and listed in. */
const FIELD_LABELS: Record<CarrierContractField, string> = {
  agentId: "Agent",
  carrierId: "Carrier",
};

const FIELDS = Object.keys(FIELD_LABELS) as CarrierContractField[];

const EMPTY_VALUES = { agentId: "", carrierId: "" };

const COVERAGE_STYLES: Record<Coverage, { bar: string }> = {
  full: { bar: "bg-green-500" },
  partial: { bar: "bg-amber-400" },
  none: { bar: "bg-gray-300" },
};

/** A card's coverage bar, left (no agents) to right (every active agent). */
const COVERAGE_GRADIENT = "linear-gradient(rgb(68, 82, 77), rgb(19, 34, 27))";

const SECTION_HEADING_CLASS = "text-xs font-semibold uppercase tracking-wide text-gray-500";

/** Initials tiles on a card face; past this, a "+n" tile stands in for the rest. */
const MAX_FACE_AGENTS = 11;

const AGENT_TILE_CLASS =
  "grid size-8 place-items-center rounded-md text-[11px] font-semibold tracking-wide";

/** Contracted agents: a soft sage that echoes the dark green coverage bar. */
const AGENT_COLOR_CLASS = "bg-[#ebfcf2] text-[#1f3a2d] ring-1 ring-inset ring-[#cfdfd6]";

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

/** First letters of the first and last word, e.g. "Jane Q. Doe" → "JD". */
const initials = (name: string) => {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export function CarrierContractsView({
  initialContracts,
  initialNotes,
  agents,
  carriers,
}: CarrierContractsViewProps) {
  const [contracts, setContracts] = useState(initialContracts);
  // Notes are still written on add; the carrier profile will show them.
  const [, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  // Off: only carriers with an active agent contracted. On: every carrier.
  const [showAll, setShowAll] = useState(false);
  // Shown when a change lands on a carrier the toggle hides. Keyed by a
  // counter, so a second hidden change restarts the timer even with the same message.
  const [hiddenNotice, setHiddenNotice] = useState<{ key: number; message: string } | null>(null);
  const { dialogRef, close: closeDialog } = useModalDialog(editor !== null);
  const id = useId();

  const activeAgents = [...agents].sort(byName);

  const agentName = (agentId: string) =>
    agents.find((agent) => agent.id === agentId)?.name ?? `Agent ${agentId}`;
  const carrierName = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.name ?? `Carrier ${carrierId}`;

  /** Values as notes show them: agent and carrier by name. */
  const shownValues = (values: ContractValues) => ({
    agentId: agentName(values.agentId),
    carrierId: carrierName(values.carrierId),
  });

  /** Coverage of one carrier among active agents, given a set of contracts. */
  const coverageOf = (carrierId: string, from: CarrierContractRecord[]) => {
    const contractedIds = new Set(
      from.filter((contract) => contract.carrierId === carrierId).map((contract) => contract.agentId),
    );
    const contractedActive = activeAgents.filter((agent) => contractedIds.has(agent.id)).length;
    const coverage: Coverage =
      contractedActive === 0
        ? "none"
        : contractedActive === activeAgents.length
          ? "full"
          : "partial";
    return { coverage, contractedIds, contractedActive };
  };

  // The hidden-carrier notice clears itself after a few seconds.
  useEffect(() => {
    if (!hiddenNotice) return;
    const timeout = setTimeout(() => setHiddenNotice(null), 6000);
    return () => clearTimeout(timeout);
  }, [hiddenNotice]);

  // One card per carrier, sorted by name, with its active agents' contracts
  // sorted by agent name. Rebuilt from state on every render, so a change shows at once.
  const activeAgentIds = new Set(agents.map((agent) => agent.id));
  const allRows = [...carriers].sort(byName).map((carrier) => {
    const { coverage, contractedActive } = coverageOf(carrier.id, contracts);
    const carrierContracts = contracts
      .filter((contract) => contract.carrierId === carrier.id && activeAgentIds.has(contract.agentId))
      .map((contract) => ({ contract, agent: agentName(contract.agentId) }))
      .sort((a, b) => a.agent.localeCompare(b.agent));
    return { carrier, coverage, contractedActive, carrierContracts };
  });
  // The toggle decides which carriers are in scope.
  const rows = showAll ? allRows : allRows.filter((row) => row.contractedActive > 0);
  // The chart groups by line, in LINES_OF_BUSINESS order, skipping empty lines.
  const groups = LINES_OF_BUSINESS.map((line) => ({
    line,
    rows: rows.filter((row) => row.carrier.linesOfBusiness.includes(line)),
  })).filter((group) => group.rows.length > 0);
  // Cards are one per contracted carrier; zeros (Show all) go in a single muted list.
  const cards = rows.filter((row) => row.contractedActive > 0);
  const zeros = rows.filter((row) => row.contractedActive === 0);

  const changeShowAll = (next: boolean) => {
    setShowAll(next);
    setHiddenNotice(null);
  };

  /** Tells the user when a change moved a carrier out of view. */
  const noticeIfHidden = (carrierId: string, nextContracts: CarrierContractRecord[], message: string) => {
    if (showAll || coverageOf(carrierId, nextContracts).contractedActive > 0) return;
    const hint = "That carrier has no active agents contracted now; turn on Show all carriers to see it.";
    setHiddenNotice((current) => ({ key: (current?.key ?? 0) + 1, message: `${message} ${hint}` }));
  };

  /**
   * Adds or edits a contract, writing a note when something changed. Returns
   * an error message instead when the agent already has a contract there.
   */
  const saveContract = (values: ContractValues, editing?: CarrierContractRecord): string | null => {
    // One contract per agent per carrier. Messages name agents and carriers, never IDs.
    const duplicate = contracts.some(
      (contract) =>
        contract.id !== editing?.id &&
        contract.agentId === values.agentId &&
        contract.carrierId === values.carrierId,
    );
    if (duplicate) {
      return `${agentName(values.agentId)} already has a contract with ${carrierName(values.carrierId)}.`;
    }

    const changes = diffValues(
      FIELDS,
      editing ? shownValues(editing) : EMPTY_VALUES,
      shownValues(values),
    );
    // Saving an edit with nothing changed just closes, without a note.
    if (changes.length === 0) return null;

    const contractId = editing?.id ?? nextId(contracts);
    const saved = { id: contractId, ...values };
    const nextContracts = editing
      ? contracts.map((contract) => (contract.id === contractId ? saved : contract))
      : [...contracts, saved];
    setContracts(nextContracts);
    setNotes((current) => [
      {
        id: nextId(current),
        contractId,
        kind: editing ? "edited" : "added",
        createdAt: new Date().toISOString(),
        changes,
      },
      ...current,
    ]);
    setUnsavedCount((count) => count + 1);
    noticeIfHidden(
      values.carrierId,
      nextContracts,
      `${agentName(values.agentId)} saved at ${carrierName(values.carrierId)}.`,
    );
    return null;
  };

  // Runs for every close: Cancel, Escape, backdrop click, or a save. Clearing
  // the editor unmounts the form, which resets it.
  const handleClose = () => {
    setEditor(null);
    setAgentError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;

    const data = new FormData(event.currentTarget);
    const text = (field: CarrierContractField) => String(data.get(field) ?? "").trim();
    const error = saveContract(
      { agentId: text("agentId"), carrierId: text("carrierId") },
      editor.mode === "edit" ? editor.contract : undefined,
    );
    if (error) {
      setAgentError(error);
      return;
    }
    closeDialog();
  };

  const editing = editor?.mode === "edit" ? editor.contract : undefined;

  return (
    <>
      <PageHeader
        title="Contracts by carrier"
        actions={
          <>
            {carriers.length > 0 ? (
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(event) => changeShowAll(event.target.checked)}
                  className="size-4 accent-gray-900"
                />
                Show all carriers
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => setEditor({ mode: "add", carrierId: "" })}
              className={PRIMARY_BUTTON_CLASS}
            >
              Add contract
            </button>
          </>
        }
      />

      <div role="status">
        {unsavedCount > 0 ? (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {unsavedCount === 1 ? "1 change" : `${unsavedCount} changes`} made on this page only.
            Nothing is saved yet, so refreshing undoes {unsavedCount === 1 ? "it" : "them"}.
          </p>
        ) : null}
        {hiddenNotice ? (
          <p key={hiddenNotice.key} className="mb-4 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
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
            <p className="rounded-lg border border-gray-200 px-4 py-6 text-center text-sm text-gray-600">
              No carriers have an active agent contracted yet. Turn on Show all carriers, or add a contract.
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
                    className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"
                  >
                    Carriers
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600">
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
                          className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs transition-shadow hover:shadow-md"
                        >
                          <div className="flex min-h-56 flex-col gap-8 px-5 pt-6 pb-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-2">
                                <h3 className="flex max-w-full items-center gap-1">
                                  <span className="truncate font-semibold tracking-tight text-gray-950">
                                    {carrier.name}
                                  </span>
                                  {carrier.status === "inactive" ? (
                                    <span className="shrink-0 text-xs font-normal text-gray-400">inactive</span>
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
                                        className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-600"
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
                                className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors hover:bg-indigo-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                              >
                                <AddAgentIcon className="size-4" />
                              </button>
                            </div>

                            {/* Initials only, full name on hover. */}
                            <ul
                              aria-label={`Agents contracted with ${carrier.name}`}
                              className="flex flex-1 flex-wrap content-start gap-1.5"
                            >
                              {shown.map(({ contract, agent }) => (
                                <li
                                  key={contract.id}
                                  title={agent}
                                  className={`${AGENT_TILE_CLASS} ${AGENT_COLOR_CLASS}`}
                                >
                                  <span aria-hidden="true">{initials(agent)}</span>
                                  <span className="sr-only">{agent}</span>
                                </li>
                              ))}
                              {hiddenCount > 0 ? (
                                <li className={`${AGENT_TILE_CLASS} bg-gray-100 text-gray-500`}>
                                  <span aria-hidden="true">+{hiddenCount}</span>
                                  <span className="sr-only">and {hiddenCount} more</span>
                                </li>
                              ) : null}
                            </ul>

                            {/* Coverage: the gradient spans the track, gray hides the uncontracted share. */}
                            <div className="flex items-center gap-3">
                              <div
                                aria-hidden="true"
                                className="relative h-1.5 flex-1 overflow-hidden rounded-full"
                                style={{ background: COVERAGE_GRADIENT }}
                              >
                                <div
                                  className="absolute inset-y-0 right-0 bg-gray-100"
                                  style={{ width: `${100 - percent}%` }}
                                />
                              </div>
                              <p className="text-sm tabular-nums">
                                <span aria-hidden="true">
                                  <span className="font-semibold text-gray-900">{contractedActive}</span>
                                  <span className="text-gray-400">/{activeAgents.length}</span>
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
                  className={`rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 ${
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
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white py-0.5 pl-3 pr-1 text-sm text-gray-600"
                      >
                        {carrier.name}
                        {carrier.status === "inactive" ? (
                          <span className="text-gray-400"> (inactive)</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setEditor({ mode: "add", carrierId: carrier.id })}
                          className="rounded-full px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        >
                          <span aria-hidden="true">+ </span>Add agent
                          <span className="sr-only"> to {carrier.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={handleClose}>
        {editor ? (
          <form onSubmit={handleSubmit} className="p-6">
            <h2 id={`${id}-title`} className="text-base font-semibold text-gray-900">
              {editing
                ? `Edit ${agentName(editing.agentId)} at ${carrierName(editing.carrierId)}`
                : "Add contract"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {editing
                ? "Saving records a note of what changed. Nothing is saved anywhere yet; refreshing undoes it."
                : "Not saved anywhere yet. The contract stays in the list until you refresh."}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                label="Agent"
                htmlFor={`${id}-agent`}
                hint={agentError ?? undefined}
                hintId={`${id}-agent-error`}
                error
              >
                <select
                  id={`${id}-agent`}
                  name="agentId"
                  required
                  defaultValue={editing?.agentId ?? ""}
                  aria-invalid={agentError ? true : undefined}
                  aria-describedby={agentError ? `${id}-agent-error` : undefined}
                  onChange={() => setAgentError(null)}
                  className={INPUT_CLASS}
                >
                  <option value="">Choose an agent</option>
                  {activeAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Carrier" htmlFor={`${id}-carrier`}>
                <select
                  id={`${id}-carrier`}
                  name="carrierId"
                  required
                  defaultValue={editing ? editing.carrierId : editor.mode === "add" ? editor.carrierId : ""}
                  onChange={() => setAgentError(null)}
                  className={INPUT_CLASS}
                >
                  <option value="">Choose a carrier</option>
                  {[...carriers].sort(byName).map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                      {carrier.status === "inactive" ? " (inactive)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeDialog} className={GHOST_BUTTON_CLASS}>
                Cancel
              </button>
              <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                {editing ? "Save changes" : "Add contract"}
              </button>
            </div>
          </form>
        ) : null}
      </ModalDialog>
    </>
  );
}
