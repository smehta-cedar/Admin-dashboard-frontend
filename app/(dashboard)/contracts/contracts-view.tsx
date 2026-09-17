"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { NoteList } from "@/components/note-list";
import { PageHeader } from "@/components/page-header";
import { MAP_BUCKETS, UsMap } from "@/components/us-map";
import { US_MAP_VIEWBOX } from "@/components/us-map-shapes";
import type { AgentRecord } from "@/lib/agents";
import type { CarrierContractNote, CarrierContractRecord } from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import { US_STATE_NAMES, US_STATES, stateSummary } from "@/lib/us-states";
import {
  APPOINTMENT_FIELD_LABELS,
  AppointmentDialog,
  normalizeStates,
  saveAppointment,
  type AppointmentEditor,
  type AppointmentError,
  type AppointmentValues,
} from "./appointment-dialog";

/*
 * Contracts by state: where agents can write, as a view over carrier
 * appointments (lib/carrier-contracts.ts). There are no carrier-less licenses:
 * an agent can write in a state only through a carrier appointment listing it.
 *
 * A map colors each state by how many distinct active agents have at least one
 * appointment there. Picking a state lists the same appointments two ways: By
 * agent (each agent with the carriers that appoint them there) or By carrier
 * (each carrier with the agents it appoints there). The Appointments table
 * lists every appointment of an active agent, sorts and searches (agent,
 * carrier, state code or name), and expands to show its states and notes.
 *
 * Add contract, the table's Edit and a state panel line all open the shared
 * AppointmentDialog (./appointment-dialog.tsx), the same form Contracts by
 * carrier uses; Edit opens it filled in, and its state grid offers only the
 * carrier's availableStates. Since every appointment stays within that
 * ceiling, a state's By carrier list only holds carriers available there.
 * Only active agents appear: `agents` holds active agents only, and
 * an appointment for any other agent stays in state but is never shown.
 * Appointments and notes live in component state only: nothing reaches a
 * server, and a refresh brings back the JSON.
 */

/** An active agent. Inactive agents are never passed in. */
type AgentOption = Pick<AgentRecord, "id" | "name">;
type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status" | "availableStates">;

type ContractsViewProps = {
  initialContracts: CarrierContractRecord[];
  initialNotes: CarrierContractNote[];
  agents: AgentOption[];
  carriers: CarrierOption[];
};

/** How the selected state's appointments are grouped. */
type StateView = "agent" | "carrier";

/** An appointment of an active agent, with names resolved and states in code order. */
type AppointmentRow = {
  contract: CarrierContractRecord;
  agent: AgentOption;
  carrier: CarrierOption;
  states: string[];
};

/*
 * Sort and search run in DataTable. Search matches state codes and names too,
 * so typing "Texas" or "TX" lists the appointments there. The actions column
 * is added in the view, since Edit opens its dialog.
 */
const COLUMNS: DataTableColumn<AppointmentRow>[] = [
  {
    id: "agent",
    header: "Agent",
    cell: ({ agent }, { expanded, toggleExpanded, detailsId }) => (
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-controls={expanded ? detailsId : undefined}
        className="-ml-1 flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 text-fg hover:bg-surface-hover"
      >
        {agent.name}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`size-4 shrink-0 text-fg-subtle transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 5l5 5-5 5" />
        </svg>
      </button>
    ),
    sortValue: ({ agent }) => agent.name,
    searchText: ({ agent }) => agent.name,
  },
  {
    id: "carrier",
    header: "Carrier",
    cell: ({ carrier }) => (
      <span className="whitespace-nowrap">
        <Link href={`/carriers/${carrier.id}`} className="text-fg hover:underline">
          {carrier.name}
        </Link>
        {carrier.status === "inactive" ? <span className="text-fg-faint"> (inactive)</span> : null}
      </span>
    ),
    sortValue: ({ carrier }) => carrier.name,
    searchText: ({ carrier }) => carrier.name,
  },
  {
    id: "states",
    header: "States",
    cell: ({ states }) => (
      <span className={states.length === 0 ? "text-fg-faint" : undefined}>
        {stateSummary(states)}
      </span>
    ),
    className: "tabular-nums text-fg-muted",
    sortValue: ({ states }) => states.length,
    searchText: ({ states }) => states.flatMap((code) => [code, US_STATE_NAMES[code] ?? ""]),
  },
];

/** Map zoom as a share of the box width: 1 fits it; above 1 the box scrolls. */
const MAP_ZOOM = { min: 0.3, max: 2, buttonStep: 0.15 };

/** Map box height as a share of the map's Fit height. */
const MAP_BOX_HEIGHT = 0.78;

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export function ContractsView({ initialContracts, initialNotes, agents, carriers }: ContractsViewProps) {
  const [contracts, setContracts] = useState(initialContracts);
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<AppointmentEditor | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [stateView, setStateView] = useState<StateView>("agent");
  // Map width as a share of its box (1 = Fit). Session only: a refresh resets it to 75%.
  const [mapZoom, setMapZoom] = useState(0.75);
  const id = useId();

  // Every appointment of an active agent, sorted by agent then carrier name (the
  // order a cleared header sort returns to). Rebuilt from live state, so an
  // edit recolors the map and moves rows at once.
  const rows = useMemo<AppointmentRow[]>(() => {
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const carriersById = new Map(carriers.map((carrier) => [carrier.id, carrier]));
    return contracts
      .flatMap((contract) => {
        const agent = agentsById.get(contract.agentId);
        if (!agent) return [];
        const carrier = carriersById.get(contract.carrierId) ?? {
          id: contract.carrierId,
          name: `Carrier ${contract.carrierId}`,
          status: "active" as const,
          availableStates: [],
        };
        return [{ contract, agent, carrier, states: normalizeStates(contract.appointedStates) }];
      })
      .sort((a, b) => byName(a.agent, b.agent) || byName(a.carrier, b.carrier));
  }, [contracts, agents, carriers]);

  // State code → appointments that include it, in row order.
  const rowsByState = useMemo(() => {
    const byState = new Map<string, AppointmentRow[]>();
    for (const row of rows) {
      for (const code of row.states) byState.set(code, [...(byState.get(code) ?? []), row]);
    }
    return byState;
  }, [rows]);

  // The map counts distinct agents, not appointments.
  const counts = useMemo(
    () =>
      Object.fromEntries(
        [...rowsByState].map(([code, list]) => [code, new Set(list.map((row) => row.agent.id)).size]),
      ),
    [rowsByState],
  );

  const writingAgentCount = new Set(rows.filter((row) => row.states.length > 0).map((row) => row.agent.id))
    .size;
  const statesCovered = [...rowsByState.keys()].filter((code) => code in US_STATE_NAMES).length;

  const stats = [
    { label: "Agents appointed", value: String(writingAgentCount) },
    { label: "States covered", value: `${statesCovered} of ${US_STATES.length}` },
    { label: "Appointments", value: String(rows.length) },
  ];

  const selectedRows = selectedCode ? (rowsByState.get(selectedCode) ?? []) : [];
  const selectedName = selectedCode ? (US_STATE_NAMES[selectedCode] ?? selectedCode) : null;
  const selectedAgentCount = counts[selectedCode ?? ""] ?? 0;

  // The selected state's appointments grouped both ways. Rows are already
  // sorted by agent then carrier, so By agent needs no resort.
  const groupBy = <K extends "agent" | "carrier", O extends "agent" | "carrier">(key: K, other: O) => {
    // `others` keeps each appointment's row, so a line can open Edit for it.
    const groups = new Map<string, { item: AppointmentRow[K]; others: AppointmentRow[] }>();
    for (const row of selectedRows) {
      const group = groups.get(row[key].id) ?? { item: row[key], others: [] };
      group.others.push(row);
      groups.set(row[key].id, group);
    }
    return [...groups.values()]
      .sort((a, b) => byName(a.item, b.item))
      .map((group) => ({
        ...group,
        others: group.others.slice().sort((a, b) => byName(a[other], b[other])),
      }));
  };
  const byAgent = groupBy("agent", "carrier");
  const byCarrier = groupBy("carrier", "agent");

  const columns = useMemo<DataTableColumn<AppointmentRow>[]>(
    () => [
      ...COLUMNS,
      {
        id: "actions",
        header: "Actions",
        srOnlyHeader: true,
        cell: ({ contract, agent, carrier }) => (
          <button
            type="button"
            onClick={() => setEditor({ mode: "edit", contract })}
            className={ROW_BUTTON_CLASS}
          >
            Edit
            <span className="sr-only">
              {" "}
              {agent.name} at {carrier.name}
            </span>
          </button>
        ),
        className: "text-right",
      },
    ],
    [],
  );

  const agentName = (agentId: string) =>
    agents.find((agent) => agent.id === agentId)?.name ?? `Agent ${agentId}`;
  const carrierName = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.name ?? `Carrier ${carrierId}`;
  const availableStates = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.availableStates ?? [];

  // Clamped and rounded to 0.01 so button clicks don't drift into float noise.
  const changeZoom = (delta: number) =>
    setMapZoom(
      Math.round(Math.min(MAP_ZOOM.max, Math.max(MAP_ZOOM.min, mapZoom + delta)) * 100) / 100,
    );

  /** Adds or edits a contract through saveAppointment. Returns the dialog's error message, if any. */
  const saveContract = (
    values: AppointmentValues,
    editing?: CarrierContractRecord,
  ): AppointmentError | null => {
    const result = saveAppointment({
      contracts,
      notes,
      values,
      editing,
      agentName,
      carrierName,
      availableStates,
    });
    if (result.error !== null) return result.error;
    // Saving an edit with nothing changed just closes, without a note.
    if (result.changed) {
      setContracts(result.contracts);
      setNotes(result.notes);
      setUnsavedCount((count) => count + 1);
    }
    return null;
  };

  const addButton = (
    <button type="button" onClick={() => setEditor({ mode: "add" })} className={PRIMARY_BUTTON_CLASS}>
      Add contract
    </button>
  );

  const viewOptions: { value: StateView; label: string }[] = [
    { value: "agent", label: "By agent" },
    { value: "carrier", label: "By carrier" },
  ];

  const selectedGroups =
    stateView === "agent"
      ? byAgent.map(({ item, others }) => ({
          key: item.id,
          title: <Link href={`/agents/${item.id}`} className="hover:underline">{item.name}</Link>,
          label: `Carriers appointing ${item.name}`,
          chips: others.map(({ contract, carrier, states }) => ({
            id: carrier.id,
            href: `/carriers/${carrier.id}`,
            name: carrier.name,
            inactive: carrier.status === "inactive",
            contract,
            states,
            editLabel: `Edit ${item.name} at ${carrier.name}`,
          })),
        }))
      : byCarrier.map(({ item, others }) => ({
          key: item.id,
          title: (
            <>
              <Link href={`/carriers/${item.id}`} className="hover:underline">
                {item.name}
              </Link>
              {item.status === "inactive" ? (
                <span className="font-normal text-fg-faint"> (inactive)</span>
              ) : null}
            </>
          ),
          label: `Agents appointed with ${item.name}`,
          chips: others.map(({ contract, agent, states }) => ({
            id: agent.id,
            href: `/agents/${agent.id}`,
            name: agent.name,
            inactive: false,
            contract,
            states,
            editLabel: `Edit ${agent.name} at ${item.name}`,
          })),
        }));

  return (
    <>
      <PageHeader
        title="Contracts by state"
        inlineDescription
        description={
          <dl className="flex flex-wrap items-center divide-x divide-line">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-2 px-3 first:pl-0 last:pr-0">
                <dt>{stat.label}</dt>
                <dd className="font-semibold tabular-nums text-fg">{stat.value}</dd>
              </div>
            ))}
          </dl>
        }
        actions={addButton}
      />

      <div role="status">
        {unsavedCount > 0 ? (
          <p className="mb-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            {unsavedCount === 1 ? "1 change" : `${unsavedCount} changes`} made on this page only.
            Nothing is saved yet, so refreshing (or leaving the page) undoes{" "}
            {unsavedCount === 1 ? "it" : "them"}.
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby={`${id}-map-title`}>
          <h2 id={`${id}-map-title`} className="sr-only">
            Where active agents can write
          </h2>
          {/*
           * The box is the map's Fit shape at 78% height; the map inside is sized
           * by zoom. When it overflows the box scrolls both ways to pan; otherwise
           * auto margins center it (and, unlike flex centering, never clip it).
           * The zoom buttons (top-right) and legend (bottom-left) sit outside the
           * scroller, so they stay pinned while the map pans under them.
           */}
          <div className="relative rounded-lg border border-line p-4">
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

            <div className="absolute right-3 top-3 z-10 flex flex-col divide-y divide-line overflow-hidden rounded-md bg-surface/90 text-sm font-medium text-fg-muted shadow-sm ring-1 ring-line/80">
              <button
                type="button"
                onClick={() => changeZoom(MAP_ZOOM.buttonStep)}
                disabled={mapZoom >= MAP_ZOOM.max}
                aria-label="Zoom in"
                className="flex size-7 items-center justify-center hover:bg-surface-hover disabled:opacity-40 disabled:hover:bg-transparent"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => changeZoom(-MAP_ZOOM.buttonStep)}
                disabled={mapZoom <= MAP_ZOOM.min}
                aria-label="Zoom out"
                className="flex size-7 items-center justify-center hover:bg-surface-hover disabled:opacity-40 disabled:hover:bg-transparent"
              >
                −
              </button>
            </div>

            <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-surface/90 px-2 py-1.5 text-xs text-fg-muted shadow-sm ring-1 ring-line/80">
              <span>Active agents appointed</span>
              <ul className="flex items-center gap-2">
                {MAP_BUCKETS.map((bucket) => (
                  <li key={bucket.label} className="flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      className={`size-3 rounded-sm ring-1 ring-inset ring-line ${bucket.swatch}`}
                    />
                    <span className="tabular-nums">{bucket.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby={`${id}-detail-title`} className="min-w-0">
          <label htmlFor={`${id}-state`} className="block text-sm font-medium text-fg">
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

          <div className="mt-4 rounded-lg border border-line p-4">
            {selectedName ? (
              <>
                {/*
                 * One row: title and counts share a baseline on the left, toggle on
                 * the right. A long state name truncates rather than wrapping.
                 */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-baseline gap-x-2">
                    <h2
                      id={`${id}-detail-title`}
                      className="min-w-0 truncate text-base font-semibold text-fg"
                    >
                      {selectedName}
                    </h2>
                    <p role="status" className="shrink-0 whitespace-nowrap text-xs text-fg-muted">
                      {selectedAgentCount === 1 ? "Agent" : "Agents"}: {selectedAgentCount} |{" "}
                      {byCarrier.length === 1 ? "Carrier" : "Carriers"}: {byCarrier.length}
                    </p>
                  </div>
                  <div
                    role="group"
                    aria-label="Group by"
                    className="inline-flex shrink-0 rounded-md bg-surface-muted p-0.5 text-xs"
                  >
                    {viewOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={stateView === option.value}
                        onClick={() => setStateView(option.value)}
                        className={`whitespace-nowrap rounded px-2 py-1 font-medium ${
                          stateView === option.value
                            ? "bg-surface text-fg shadow-xs ring-1 ring-line"
                            : "text-fg-muted hover:text-fg"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                </div>

                {selectedRows.length > 0 ? (
                  <>
                    
                    <ul className="mt-6 space-y-4 text-sm p-2  ">
                      {selectedGroups.map((group) => (
                        <li key={group.key} className="border-b border-line pb-4 ">
                          <p className="font-semibold text-fg">{group.title}</p>
                          <ul aria-label={group.label} className=" pl-4 list-disc" >
                            {group.chips.map((chip) => (
                              // Clicking the line opens Edit; the name link goes to the
                              // profile instead. The states button is the keyboard way in.
                              <li
                                key={chip.id}
                                onClick={() => setEditor({ mode: "edit", contract: chip.contract })}
                                className="cursor-pointer rounded hover:bg-surface-hover"
                              >
                                {/* Name stays whole; a long code list wraps on the right. */}
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="shrink-0">
                                    <Link
                                      href={chip.href}
                                      onClick={(event) => event.stopPropagation()}
                                      className="text-xs text-fg-subtle hover:text-fg hover:underline"
                                    >
                                      {chip.name}
                                    </Link>
                                    {chip.inactive ? (
                                      <span className="text-xs text-fg-faint"> (inactive)</span>
                                    ) : null}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setEditor({ mode: "edit", contract: chip.contract });
                                    }}
                                    title={chip.editLabel}
                                    className="min-w-0 rounded px-1 text-right text-xs tabular-nums text-fg-faint hover:text-fg"
                                  >
                                    {stateSummary(chip.states)}
                                    <span className="sr-only">. {chip.editLabel}</span>
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-fg-subtle">
                    No agents can operate in {selectedName} via any carrier yet.
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 id={`${id}-detail-title`} className="text-base font-semibold text-fg">
                  No state selected
                </h2>
                <p className="mt-1 text-sm text-fg-muted">
                  Click a state on the map to view the agents and carriers that can operate in that state.
                </p>
              </>
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby={`${id}-table-title`} className="mt-8">
        <h2 id={`${id}-table-title`} className="mb-3 text-base font-semibold text-fg">
          Appointments
        </h2>
        {rows.length === 0 ? (
          <EmptyState
            title="No appointments yet"
            description="Add a contract to list where an agent can write."
            action={addButton}
          />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={({ contract }) => contract.id}
            unit={["appointment", "appointments"]}
            searchPlaceholder="Search agent, carrier or state…"
            renderDetails={({ contract, states }) => (
              <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    States
                  </h3>
                  {states.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 text-sm text-fg-muted">
                      {states.map((code) => (
                        <li key={code}>{US_STATE_NAMES[code] ?? code}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-fg-subtle">None yet</p>
                  )}
                </section>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    Notes
                  </h3>
                  <NoteList
                    notes={notes.filter((note) => note.contractId === contract.id)}
                    labels={APPOINTMENT_FIELD_LABELS}
                  />
                </section>
              </div>
            )}
          />
        )}
      </section>

      <AppointmentDialog
        editor={editor}
        agents={agents}
        carriers={carriers}
        onSave={saveContract}
        onClose={() => setEditor(null)}
      />
    </>
  );
}
