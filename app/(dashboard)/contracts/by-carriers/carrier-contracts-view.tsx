"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import {
  GHOST_BUTTON_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  ROW_BUTTON_CLASS,
} from "@/components/classes";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { NoteList } from "@/components/note-list";
import { PageHeader } from "@/components/page-header";
import type { AgentRecord } from "@/lib/agents";
import type {
  CarrierContractField,
  CarrierContractNote,
  CarrierContractRecord,
} from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import { diffValues, nextId } from "@/lib/change-notes";

/*
 * Every carrier as a card, color-coded by how many active agents are
 * contracted with it: full (green), partial (amber) or none (gray). A contract
 * has no status: a row means the agent is contracted. Only active agents
 * appear: `agents` holds active agents only (status is edited on the Agents
 * page), and a contract for any other agent stays in state but is never shown
 * or counted, ready for when that agent is active again. Clicking a
 * carrier name expands the card to list its contracts (Edit, Remove), the
 * active agents still missing, and notes. Add, edit and remove are dummy:
 * contracts and notes live in component state only, and a refresh brings back
 * the JSON.
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

/** Full: every active agent contracted. Partial: some. None: no active agent. */
type Coverage = "full" | "partial" | "none";

type CoverageFilter = "all" | Coverage;

/** Also the order changes are compared and listed in. */
const FIELD_LABELS: Record<CarrierContractField, string> = {
  agentId: "Agent",
  carrierId: "Carrier",
};

const FIELDS = Object.keys(FIELD_LABELS) as CarrierContractField[];

const EMPTY_VALUES = { agentId: "", carrierId: "" };

const COVERAGE_ORDER: Coverage[] = ["full", "partial", "none"];

const COVERAGE_STYLES: Record<
  Coverage,
  { label: string; card: string; bar: string; pill: string; dot: string }
> = {
  full: {
    label: "Full",
    card: "border-l-green-500",
    bar: "bg-green-500",
    pill: "bg-green-50 text-green-700",
    dot: "bg-green-500",
  },
  partial: {
    label: "Partial",
    card: "border-l-amber-400",
    bar: "bg-amber-400",
    pill: "bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
  },
  none: {
    label: "None",
    card: "border-l-gray-300",
    bar: "bg-gray-300",
    pill: "bg-gray-100 text-gray-600",
    dot: "bg-gray-300",
  },
};

const FILTER_EMPTY_TEXT: Record<Coverage, string> = {
  full: "No carriers have every active agent contracted.",
  partial: "No carriers are partly covered.",
  none: "Every carrier has at least one active agent contracted.",
};

const CHIP_CLASS = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

const SECTION_HEADING_CLASS = "text-xs font-semibold uppercase tracking-wide text-gray-500";

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export function CarrierContractsView({
  initialContracts,
  initialNotes,
  agents,
  carriers,
}: CarrierContractsViewProps) {
  const [contracts, setContracts] = useState(initialContracts);
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  // Shown when a change lands on a carrier the filter hides. Keyed by a
  // counter, so a second hidden change restarts the timer even with the same message.
  const [hiddenNotice, setHiddenNotice] = useState<{ key: number; message: string } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
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
    const { coverage, contractedIds, contractedActive } = coverageOf(carrier.id, contracts);
    const carrierContracts = contracts
      .filter((contract) => contract.carrierId === carrier.id && activeAgentIds.has(contract.agentId))
      .map((contract) => ({ contract, agent: agentName(contract.agentId) }))
      .sort((a, b) => a.agent.localeCompare(b.agent));
    const missing = activeAgents.filter((agent) => !contractedIds.has(agent.id));
    return { carrier, coverage, contractedActive, carrierContracts, missing };
  });
  const coverageCounts = Object.fromEntries(
    COVERAGE_ORDER.map((coverage) => [
      coverage,
      allRows.filter((row) => row.coverage === coverage).length,
    ]),
  ) as Record<Coverage, number>;
  const rows = allRows.filter((row) => coverageFilter === "all" || row.coverage === coverageFilter);

  const changeCoverageFilter = (filter: CoverageFilter) => {
    setCoverageFilter(filter);
    setHiddenNotice(null);
  };

  /** Tells the user when a change moved a carrier out of the current filter. */
  const noticeIfHidden = (carrierId: string, nextContracts: CarrierContractRecord[], message: string) => {
    if (coverageFilter === "all" || coverageOf(carrierId, nextContracts).coverage === coverageFilter) {
      return;
    }
    setHiddenNotice((current) => ({
      key: (current?.key ?? 0) + 1,
      message: `${message} That carrier is hidden by the current filter.`,
    }));
  };

  const toggleExpanded = (carrierId: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(carrierId)) next.add(carrierId);
      return next;
    });

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
    // Open the carrier the contract now belongs to, so the change is in view.
    setExpandedIds((current) => new Set(current).add(values.carrierId));
    noticeIfHidden(
      values.carrierId,
      nextContracts,
      `${agentName(values.agentId)} saved at ${carrierName(values.carrierId)}.`,
    );
    return null;
  };

  /** Ends a contract. Its notes stay in state but no longer show. */
  const removeContract = (contract: CarrierContractRecord) => {
    const nextContracts = contracts.filter((current) => current.id !== contract.id);
    setContracts(nextContracts);
    setUnsavedCount((count) => count + 1);
    noticeIfHidden(
      contract.carrierId,
      nextContracts,
      `${agentName(contract.agentId)} removed from ${carrierName(contract.carrierId)}.`,
    );
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

  const filterOptions: { value: CoverageFilter; label: string; count: number }[] = [
    { value: "all", label: "All carriers", count: allRows.length },
    ...COVERAGE_ORDER.map((coverage) => ({
      value: coverage,
      label: `${COVERAGE_STYLES[coverage].label} coverage`,
      count: coverageCounts[coverage],
    })),
  ];

  return (
    <>
      <PageHeader
        title="Contracts by carrier"

        actions={
          <button
            type="button"
            onClick={() => setEditor({ mode: "add", carrierId: "" })}
            className={PRIMARY_BUTTON_CLASS}
          >
            Add contract
          </button>
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
          {/* Summary strip, doubling as the coverage filter. */}
          <div
            role="group"
            aria-label="Filter carriers by coverage"
            className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {filterOptions.map((option) => {
              const selected = coverageFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => changeCoverageFilter(option.value)}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                    selected
                      ? "border-gray-900 bg-white ring-1 ring-gray-900"
                      : "border-gray-200 bg-white hover:border-gray-400"
                  }`}
                >
                  <span className="text-xl font-semibold tabular-nums text-gray-900">
                    {option.count}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-gray-600">
                    {option.value !== "all" ? (
                      <span
                        aria-hidden="true"
                        className={`size-2 rounded-full ${COVERAGE_STYLES[option.value].dot}`}
                      />
                    ) : null}
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <p className="rounded-lg border border-gray-200 px-4 py-6 text-center text-sm text-gray-600">
              {coverageFilter === "all" ? null : FILTER_EMPTY_TEXT[coverageFilter]}
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map(
                ({ carrier, coverage, contractedActive, carrierContracts, missing }) => {
                  const expanded = expandedIds.has(carrier.id);
                  const detailsId = `${id}-details-${carrier.id}`;
                  const styles = COVERAGE_STYLES[coverage];
                  const percent =
                    activeAgents.length === 0 ? 0 : (contractedActive / activeAgents.length) * 100;
                  const notedContracts = carrierContracts
                    .map((row) => ({
                      ...row,
                      notes: notes.filter((note) => note.contractId === row.contract.id),
                    }))
                    .filter((row) => row.notes.length > 0);

                  return (
                    <li
                      key={carrier.id}
                      className={`overflow-hidden rounded-lg border border-l-4 border-gray-200 bg-white ${styles.card}`}
                    >
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
                        <div className="min-w-0 flex-1 basis-64">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(carrier.id)}
                              aria-expanded={expanded}
                              aria-controls={expanded ? detailsId : undefined}
                              className="-ml-1 flex items-center gap-1 rounded-md px-1 py-0.5 font-medium text-gray-900 hover:bg-gray-100"
                            >
                              {carrier.name}
                              {carrier.status === "inactive" ? (
                                <span className="font-normal text-gray-500"> (inactive)</span>
                              ) : null}
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 20 20"
                                className={`size-4 shrink-0 text-gray-500 transition-transform ${expanded ? "rotate-90" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M8 5l5 5-5 5" />
                              </svg>
                            </button>
                            {carrier.linesOfBusiness.map((line) => (
                              <span key={line} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                                {line}
                              </span>
                            ))}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {carrierContracts.map(({ contract, agent }) => (
                              <span
                                key={contract.id}
                                className={`${CHIP_CLASS} bg-green-50 text-green-800 ring-1 ring-inset ring-green-600/20`}
                              >
                                {agent}
                              </span>
                            ))}
                            {coverage === "partial"
                              ? missing.map((agent) => (
                                  <button
                                    key={agent.id}
                                    type="button"
                                    onClick={() => saveContract({ agentId: agent.id, carrierId: carrier.id })}
                                    className={`${CHIP_CLASS} border border-dashed border-gray-300 text-gray-500 hover:border-gray-500 hover:text-gray-900`}
                                  >
                                    <span aria-hidden="true">+&nbsp;</span>
                                    <span className="sr-only">Add </span>
                                    {agent.name}
                                    <span className="sr-only"> to {carrier.name}</span>
                                  </button>
                                ))
                              : null}
                            {carrierContracts.length === 0 ? (
                              <span className="text-sm text-gray-500">No agents contracted</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="w-full sm:w-52">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${styles.pill}`}>
                              {styles.label}
                            </span>
                            <span className="tabular-nums text-gray-700">
                              {contractedActive} of {activeAgents.length}{" "}
                              <span className="text-gray-500">active</span>
                            </span>
                          </div>
                          <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${percent}%` }} />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setEditor({ mode: "add", carrierId: carrier.id })}
                          className={`${ROW_BUTTON_CLASS} whitespace-nowrap`}
                        >
                          Add agent<span className="sr-only"> to {carrier.name}</span>
                        </button>
                      </div>

                      {expanded ? (
                        <div
                          id={detailsId}
                          className="grid gap-4 border-t border-gray-200 bg-gray-50 px-4 py-4 sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
                        >
                          <div className="space-y-4">
                            <section>
                              <h3 className={SECTION_HEADING_CLASS}>Contracted agents</h3>
                              {carrierContracts.length === 0 ? (
                                <p className="mt-2 text-sm text-gray-500">
                                  No agents contracted with {carrier.name} yet.
                                </p>
                              ) : (
                                <ul className="mt-2 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
                                  {carrierContracts.map(({ contract, agent }) => (
                                    <li key={contract.id} className="flex items-center gap-2 py-1.5 pl-3 pr-1.5">
                                      <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                                        {agent}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setEditor({ mode: "edit", contract })}
                                        className={ROW_BUTTON_CLASS}
                                      >
                                        Edit
                                        <span className="sr-only">
                                          {" "}
                                          {agent} at {carrier.name}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeContract(contract)}
                                        className="rounded-md px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
                                      >
                                        Remove
                                        <span className="sr-only">
                                          {" "}
                                          {agent} from {carrier.name}
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </section>
                            {missing.length > 0 ? (
                              <section>
                                <h3 className={SECTION_HEADING_CLASS}>Active agents not contracted</h3>
                                <ul className="mt-2 divide-y divide-gray-200 rounded-md border border-dashed border-gray-300 bg-white">
                                  {missing.map((agent) => (
                                    <li key={agent.id} className="flex items-center gap-2 py-1.5 pl-3 pr-1.5">
                                      <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                                        {agent.name}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => saveContract({ agentId: agent.id, carrierId: carrier.id })}
                                        className={ROW_BUTTON_CLASS}
                                      >
                                        Add
                                        <span className="sr-only">
                                          {" "}
                                          {agent.name} to {carrier.name}
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </section>
                            ) : null}
                          </div>
                          <section>
                            <h3 className={SECTION_HEADING_CLASS}>Notes</h3>
                            {/* Grouped by agent; a contract moved to another carrier takes its notes along. */}
                            {notedContracts.length === 0 ? (
                              <NoteList notes={[]} labels={FIELD_LABELS} />
                            ) : (
                              <div className="mt-2 space-y-3">
                                {notedContracts.map(({ contract, agent, notes: contractNotes }) => (
                                  <div key={contract.id}>
                                    <h4 className="text-sm font-medium text-gray-900">{agent}</h4>
                                    <NoteList notes={contractNotes} labels={FIELD_LABELS} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>
                        </div>
                      ) : null}
                    </li>
                  );
                },
              )}
            </ul>
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
