"use client";

import { Fragment, useId, useMemo, useState, type FormEvent } from "react";
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
import { StatusBadge } from "@/components/status-badge";
import { MAP_BUCKETS, UsMap } from "@/components/us-map";
import { US_MAP_VIEWBOX } from "@/components/us-map-shapes";
import type { AgentRecord } from "@/lib/agents";
import { diffValues, nextId } from "@/lib/change-notes";
import type { ContractField, ContractNote, ContractRecord } from "@/lib/contracts";
import { US_STATE_NAMES, US_STATES } from "@/lib/us-states";

/*
 * Contracts: which agents are licensed in which states. A map colors each
 * state by how many agents hold an active license there; clicking a state lists
 * those agents. Contracts can be added and edited in a dialog, and every add or
 * edit records a note (agent by name). The All licenses table reaches every
 * contract, inactive ones included, and expands to show its states and notes.
 * Contracts and notes live in component state only: nothing reaches a server,
 * and a refresh brings back the JSON. Carrier contracts come in a later phase.
 */

type AgentOption = Pick<AgentRecord, "id" | "name" | "status">;

type ContractsViewProps = {
  initialContracts: ContractRecord[];
  initialNotes: ContractNote[];
  agents: AgentOption[];
};

/** Which dialog is open. Edit holds the contract as it was when the dialog opened. */
type Editor = { mode: "add" } | { mode: "edit"; contract: ContractRecord };

type ContractValues = Omit<ContractRecord, "id">;

/** Also the order changes are compared and listed in. */
const FIELD_LABELS: Record<ContractField, string> = {
  agentId: "Agent",
  licensedStates: "Licensed states",
  status: "Status",
};

const FIELDS = Object.keys(FIELD_LABELS) as ContractField[];

const COLUMNS = ["Agent", "States", "Status"];

/** Map zoom as a share of the box width: 1 fits it; above 1 the box scrolls. */
const MAP_ZOOM = { min: 0.3, max: 2, buttonStep: 0.15 };

/** Map box height as a share of the map's Fit height. */
const MAP_BOX_HEIGHT = 0.78;

const EMPTY_VALUES ={ agentId: "", licensedStates: [] };

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** Unique codes in code order, so a list's order never shows up as a change. */
const normalizeStates = (codes: string[]) => [...new Set(codes)].sort();

export function ContractsView({ initialContracts, initialNotes, agents }: ContractsViewProps) {
  const [contracts, setContracts] = useState(initialContracts);
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  // Agent chosen in the Add dialog, so its existing contract (if any) can load.
  const [pickedAgentId, setPickedAgentId] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  // Map width as a share of its box (1 = Fit). Session only: a refresh resets it to 75%.
  const [mapZoom, setMapZoom] = useState(0.75);
  const { dialogRef, close: closeDialog } = useModalDialog(editor !== null);
  const id = useId();

  const agentName = (agentId: string) =>
    agents.find((agent) => agent.id === agentId)?.name ?? `Agent ${agentId}`;

  /** Values as notes show them: agent by name, states in code order. */
  const shownValues = (values: ContractValues) => ({
    ...values,
    agentId: agentName(values.agentId),
    licensedStates: normalizeStates(values.licensedStates),
  });

  // State code → active contracts licensed there, with the agent, sorted by
  // agent name. Built from live state, so adds and edits recolor the map.
  const licensesByState = useMemo(() => {
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const byState = new Map<string, { agent: AgentOption; contract: ContractRecord }[]>();
    for (const contract of contracts) {
      if (contract.status !== "active") continue;
      const agent = agentsById.get(contract.agentId);
      if (!agent) continue;
      for (const code of new Set(contract.licensedStates)) {
        byState.set(code, [...(byState.get(code) ?? []), { agent, contract }]);
      }
    }
    for (const list of byState.values()) list.sort((a, b) => byName(a.agent, b.agent));
    return byState;
  }, [contracts, agents]);

  const counts = useMemo(
    () => Object.fromEntries([...licensesByState].map(([code, list]) => [code, list.length])),
    [licensesByState],
  );

  const licensedAgentCount = new Set(
    [...licensesByState.values()].flat().map(({ agent }) => agent.id),
  ).size;
  const statesCovered = [...licensesByState.keys()].filter((code) => code in US_STATE_NAMES).length;

  const selectedLicenses = selectedCode ? (licensesByState.get(selectedCode) ?? []) : [];
  const selectedName = selectedCode ? (US_STATE_NAMES[selectedCode] ?? selectedCode) : null;

  const stats = [
    { label: "Licensed agents", value: String(licensedAgentCount) },
    { label: "States covered", value: `${statesCovered} of ${US_STATES.length}` },
  ];

  // Every contract, sorted by agent name. Rebuilt on every render, so an add
  // lands in its sorted place at once.
  const rows = contracts
    .map((contract) => ({ contract, agent: agentName(contract.agentId) }))
    .sort((a, b) => a.agent.localeCompare(b.agent));

  // Add offers every agent. One contract per agent, so picking an agent who
  // already has one loads that contract and saving updates it.
  const sortedAgents = [...agents].sort(byName);
  const contractFor = (agentId: string) =>
    contracts.find((contract) => contract.agentId === agentId);

  // Clamped and rounded to 0.01 so button clicks don't drift into float noise.
  const changeZoom = (delta: number) =>
    setMapZoom(
      Math.round(Math.min(MAP_ZOOM.max, Math.max(MAP_ZOOM.min, mapZoom + delta)) * 100) / 100,
    );

  const toggleExpanded =(contractId: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(contractId)) next.add(contractId);
      return next;
    });

  // Runs for every close: Cancel, Escape, backdrop click, or a save. Clearing
  // the editor unmounts the form, which resets it.
  const handleClose = () => {
    setEditor(null);
    setAgentError(null);
    setPickedAgentId("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;

    const data = new FormData(event.currentTarget);
    // The agent can't change on edit, so it isn't a form field there.
    const agentId =
      editor.mode === "edit" ? editor.contract.agentId : String(data.get("agentId") ?? "").trim();

    const agentMessage = agents.some((agent) => agent.id === agentId)
      ? null
      : "Choose an agent from the agent list.";
    setAgentError(agentMessage);
    if (agentMessage) return;

    // Adding for an agent who already has a contract updates that contract.
    const existing = editor.mode === "edit" ? editor.contract : contractFor(agentId);
    const values: ContractValues = {
      agentId,
      licensedStates: normalizeStates(
        data.getAll("licensedStates").map((code) => String(code).trim()).filter(Boolean),
      ),
      // Status isn't editable here: an update keeps it and a new contract starts active.
      status: existing?.status ?? "active",
    };

    const contractId = existing?.id ?? nextId(contracts);
    const changes = diffValues(
      FIELDS,
      existing ? shownValues(existing) : EMPTY_VALUES,
      shownValues(values),
    );

    // Saving an edit with nothing changed just closes, without a note.
    if (changes.length > 0) {
      setContracts((current) =>
        existing
          ? current.map((contract) =>
              contract.id === contractId ? { id: contractId, ...values } : contract,
            )
          : [...current, { id: contractId, ...values }],
      );
      setNotes((current) => [
        {
          id: nextId(current),
          contractId,
          kind: existing ? "edited" : "added",
          createdAt: new Date().toISOString(),
          changes,
        },
        ...current,
      ]);
      setUnsavedCount((count) => count + 1);
    }
    closeDialog();
  };

  const addButton = (
    <button type="button" onClick={() => setEditor({ mode: "add" })} className={PRIMARY_BUTTON_CLASS}>
      Add contract
    </button>
  );

  const editing = editor?.mode === "edit" ? editor.contract : undefined;
  // In Add, the picked agent's existing contract; its states prefill the form.
  const pickedContract = editor?.mode === "add" ? contractFor(pickedAgentId) : undefined;
  const formContract = editing ?? pickedContract;

  return (
    <>
      <PageHeader
        title="Contracts"
        inlineDescription
        description={
          <dl className="flex flex-wrap items-center divide-x divide-gray-200">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-2 px-3 first:pl-0 last:pr-0">
                <dt>{stat.label}</dt>
                <dd className="font-semibold tabular-nums text-gray-900">{stat.value}</dd>
              </div>
            ))}
          </dl>
        }
        actions={addButton}
      />

      <div role="status">
        {unsavedCount > 0 ? (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {unsavedCount === 1 ? "1 change" : `${unsavedCount} changes`} made on this page only.
            Nothing is saved yet, so refreshing undoes {unsavedCount === 1 ? "it" : "them"}.
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby={`${id}-map-title`}>
          <h2 id={`${id}-map-title`} className="sr-only">
            Active agents by state
          </h2>
          {/*
           * The box is the map's Fit shape at 90% height; the map inside is sized
           * by zoom. When it overflows the box scrolls both ways to pan; otherwise
           * auto margins center it (and, unlike flex centering, never clip it).
           * The zoom buttons (top-right) and legend (bottom-left) sit outside the
           * scroller, so they stay pinned while the map pans under them.
           */}
          <div className="relative rounded-lg border border-gray-200 p-4">
            <div
              className="flex overflow-auto"
              style={{
                aspectRatio: `${US_MAP_VIEWBOX.width} / ${US_MAP_VIEWBOX.height * MAP_BOX_HEIGHT}`,
              }}
            >
              <div className="m-auto shrink-0" style={{ width: `${Math.round(mapZoom * 100)}%` }}>
                <UsMap
                  counts={counts}
                  selectedCode={selectedCode}
                  onSelect={setSelectedCode}
                  unit={["agent", "agents"]}
                />
              </div>
            </div>

            <div className="absolute right-3 top-3 z-10 flex flex-col divide-y divide-gray-200 overflow-hidden rounded-md bg-white/90 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200/80">
              <button
                type="button"
                onClick={() => changeZoom(MAP_ZOOM.buttonStep)}
                disabled={mapZoom >= MAP_ZOOM.max}
                aria-label="Zoom in"
                className="flex size-7 items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => changeZoom(-MAP_ZOOM.buttonStep)}
                disabled={mapZoom <= MAP_ZOOM.min}
                aria-label="Zoom out"
                className="flex size-7 items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                −
              </button>
            </div>

            <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-white/90 px-2 py-1.5 text-xs text-gray-600 shadow-sm ring-1 ring-gray-200/80">
              <span>Active agents licensed</span>
              <ul className="flex items-center gap-2">
                {MAP_BUCKETS.map((bucket) => (
                  <li key={bucket.label} className="flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      className={`size-3 rounded-sm ring-1 ring-inset ring-gray-900/10 ${bucket.swatch}`}
                    />
                    <span className="tabular-nums">{bucket.label}</span>
                  </li>
                ))}
              </ul>
            </div>
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
                  {selectedLicenses.length} active {selectedLicenses.length === 1 ? "agent" : "agents"}{" "}
                  licensed
                </p>
                {selectedLicenses.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm">
                    {selectedLicenses.map(({ agent, contract }) => (
                      <li key={contract.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-gray-900">{agent.name}</span>
                        <button
                          type="button"
                          onClick={() => setEditor({ mode: "edit", contract })}
                          className={ROW_BUTTON_CLASS}
                        >
                          Edit<span className="sr-only"> licenses for {agent.name}</span>
                        </button>
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

      <section aria-labelledby={`${id}-table-title`} className="mt-8">
        <h2 id={`${id}-table-title`} className="mb-3 text-base font-semibold text-gray-900">
          All licenses
        </h2>
        {contracts.length === 0 ? (
          <EmptyState
            title="No contracts yet"
            description="Add a contract to list an agent's licensed states."
            action={addButton}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {COLUMNS.map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-600"
                    >
                      {heading}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 border-t border-gray-200">
                {rows.map(({ contract, agent }) => {
                  const expanded = expandedIds.has(contract.id);
                  const detailsId = `${id}-details-${contract.id}`;
                  const states = normalizeStates(contract.licensedStates);

                  return (
                    <Fragment key={contract.id}>
                      <tr className={expanded ? "bg-gray-50" : undefined}>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(contract.id)}
                            aria-expanded={expanded}
                            aria-controls={expanded ? detailsId : undefined}
                            className="-ml-1 flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 text-gray-900 hover:bg-gray-100"
                          >
                            {agent}
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
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-gray-600">{states.length}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={contract.status} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setEditor({ mode: "edit", contract })}
                            className={ROW_BUTTON_CLASS}
                          >
                            Edit<span className="sr-only"> licenses for {agent}</span>
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr id={detailsId} className="bg-gray-50">
                          <td colSpan={COLUMNS.length + 1} className="px-4 pb-4 pt-1">
                            <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                              <section>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Licensed states
                                </h3>
                                {states.length > 0 ? (
                                  <ul className="mt-2 space-y-0.5 text-sm text-gray-700">
                                    {states.map((code) => (
                                      <li key={code}>{US_STATE_NAMES[code] ?? code}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-2 text-sm text-gray-500">None</p>
                                )}
                              </section>
                              <section>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Notes
                                </h3>
                                <NoteList
                                  notes={notes.filter((note) => note.contractId === contract.id)}
                                  labels={FIELD_LABELS}
                                />
                              </section>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={handleClose}>
        {editor ? (
          <form onSubmit={handleSubmit} className="p-6">
            <h2 id={`${id}-title`} className="text-base font-semibold text-gray-900">
              {editing ? `Edit licenses for ${agentName(editing.agentId)}` : "Add contract"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {editing
                ? "Saving records a note of what changed. Nothing is saved anywhere yet; refreshing undoes it."
                : "Not saved anywhere yet. The contract stays on the page until you refresh."}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {editing ? (
                <Field
                  label="Agent"
                  htmlFor={`${id}-agent`}
                  hint="The agent can't be changed."
                  hintId={`${id}-agent-hint`}
                  className="sm:col-span-2"
                >
                  <input
                    id={`${id}-agent`}
                    type="text"
                    readOnly
                    value={agentName(editing.agentId)}
                    aria-describedby={`${id}-agent-hint`}
                    className={`${INPUT_CLASS} bg-gray-50 text-gray-600`}
                  />
                </Field>
              ) : (
                <Field
                  label="Agent"
                  htmlFor={`${id}-agent`}
                  hint={
                    agentError ??
                    (pickedContract
                      ? `${agentName(pickedAgentId)} already has a contract. Saving updates it.`
                      : undefined)
                  }
                  hintId={`${id}-agent-error`}
                  error={agentError !== null}
                  className="sm:col-span-2"
                >
                  <select
                    id={`${id}-agent`}
                    name="agentId"
                    required
                    value={pickedAgentId}
                    aria-invalid={agentError ? true : undefined}
                    aria-describedby={agentError || pickedContract ? `${id}-agent-error` : undefined}
                    onChange={(event) => {
                      setPickedAgentId(event.target.value);
                      setAgentError(null);
                    }}
                    className={INPUT_CLASS}
                  >
                    <option value="">Choose an agent</option>
                    {sortedAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                        {agent.status === "inactive" ? " (inactive)" : ""}
                        {contractFor(agent.id) ? " (has contract)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <fieldset className="sm:col-span-2" aria-describedby={`${id}-states-hint`}>
                <legend className="block text-sm font-medium text-gray-900">Licensed states</legend>
                <p id={`${id}-states-hint`} className="mt-1 text-xs text-gray-500">
                  Leave all unchecked if the agent holds no licenses yet.
                </p>
                <div
                  key={formContract?.id ?? "new"}
                  className="mt-2 grid max-h-64 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto rounded-md border border-gray-200 p-3 sm:grid-cols-3"
                >
                  {US_STATES.map((state) => (
                    <label key={state.code} className="flex items-center gap-2 text-sm text-gray-900">
                      <input
                        type="checkbox"
                        name="licensedStates"
                        value={state.code}
                        defaultChecked={formContract?.licensedStates.includes(state.code)}
                        className="size-4 shrink-0 accent-gray-900"
                      />
                      <span className="min-w-0 truncate" title={state.name}>
                        {state.name}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeDialog} className={GHOST_BUTTON_CLASS}>
                Cancel
              </button>
              <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                {formContract ? "Save changes" : "Add contract"}
              </button>
            </div>
          </form>
        ) : null}
      </ModalDialog>
    </>
  );
}
