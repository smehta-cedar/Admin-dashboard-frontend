"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS, TOOLBAR_INPUT_CLASS } from "@/components/classes";
import { CredentialValue } from "@/components/credential-value";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { NoteList } from "@/components/note-list";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import { UnsavedBanner } from "@/components/unsaved-banner";
import type { LoginNote, LoginRecord } from "@/lib/logins";
import { byName } from "@/lib/text";
import {
  LOGIN_FIELD_LABELS,
  LoginDialog,
  saveLogin,
  type AgentOption,
  type CarrierOption,
  type LoginEditor,
  type LoginError,
  type LoginValues,
} from "./login-dialog";

/*
 * Logins table with dummy add and edit. Each login is one agent at one
 * carrier. Add login and a row's Edit open the shared LoginDialog
 * (./login-dialog.tsx: `LoginDialog` + pure `saveLogin`, the same shape as the
 * other entity dialogs); every add or edit records a note listing what changed
 * (agent and carrier by name), and clicking an agent name expands the row to
 * show that login's notes. A carrier dropdown filters the list (?carrier=<id>);
 * within it, the table sorts by header and narrows by search. Logins and notes
 * live in component state only: nothing reaches a server, and a refresh brings
 * back the JSON.
 */

type LoginsViewProps = {
  initialLogins: LoginRecord[];
  initialNotes: LoginNote[];
  agents: AgentOption[];
  carriers: CarrierOption[];
};

/** A table row: the login with its agent and carrier names looked up. */
type LoginRow = { login: LoginRecord; agent: string; carrier: string };

/*
 * Sort and search run in DataTable. The password is neither sortable nor
 * searchable, so typing part of one never reveals which row it belongs to.
 * The actions column is added in the view, since Edit opens its dialog.
 */
const COLUMNS: DataTableColumn<LoginRow>[] = [
  {
    id: "agent",
    header: "Agent",
    cell: ({ agent, carrier }, { expanded, toggleExpanded, detailsId }) => (
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-controls={expanded ? detailsId : undefined}
        className="-ml-1 flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 text-fg hover:bg-surface-hover"
      >
        {agent}
        <span className="sr-only"> at {carrier}</span>
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
    sortValue: ({ agent }) => agent,
    searchText: ({ agent }) => agent,
  },
  {
    id: "carrier",
    header: "Carrier",
    cell: ({ carrier }) => carrier,
    className: "whitespace-nowrap text-fg",
    sortValue: ({ carrier }) => carrier,
    searchText: ({ carrier }) => carrier,
  },
  {
    id: "writingNumber",
    header: "Writing number",
    cell: ({ login }) => login.writingNumber,
    className: "font-mono text-fg-muted",
    sortValue: ({ login }) => login.writingNumber,
    searchText: ({ login }) => login.writingNumber,
  },
  {
    id: "username",
    header: "Portal username",
    cell: ({ login }) => <CredentialValue value={login.username} label="username" />,
    className: "text-fg-muted",
    sortValue: ({ login }) => login.username,
    searchText: ({ login }) => login.username,
  },
  {
    id: "password",
    header: "Password",
    cell: ({ login }) => <CredentialValue value={login.portalPassword} label="password" secret />,
    className: "text-fg-muted",
  },
  {
    id: "status",
    header: "Status",
    cell: ({ login }) => <StatusBadge status={login.status} />,
    sortValue: ({ login }) => statusRank(login.status),
    searchText: ({ login }) => login.status,
  },
];

export function LoginsView({ initialLogins, initialNotes, agents, carriers }: LoginsViewProps) {
  const [logins, setLogins] = useState(initialLogins);
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<LoginEditor | null>(null);
  // Shown when Add saves a login the carrier filter hides. Each add sets a new
  // object, so a second hidden add restarts the timer even with the same message.
  const [hiddenNotice, setHiddenNotice] = useState<{ message: string } | null>(null);
  const id = useId();
  const searchParams = useSearchParams();
  // Carrier ID to filter by, or "" for all carriers. Seeded from ?carrier=; the
  // route renders per request, so the server and first client render agree.
  // An unknown ID stays in the URL but shows as all carriers.
  const [carrierFilter, setCarrierFilter] = useState(() => {
    const carrierId = searchParams.get("carrier") ?? "";
    return carriers.some((carrier) => carrier.id === carrierId) ? carrierId : "";
  });

  const agentName = (agentId: string) =>
    agents.find((agent) => agent.id === agentId)?.name ?? `Agent ${agentId}`;
  const carrierName = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.name ?? `Carrier ${carrierId}`;

  // State drives the select, so it changes on this render; replaceState keeps
  // the choice in the URL without a reload or refetch. "All carriers" drops it.
  const changeCarrierFilter = (carrierId: string) => {
    setCarrierFilter(carrierId);
    setHiddenNotice(null);
    const params = new URLSearchParams(window.location.search);
    if (carrierId) params.set("carrier", carrierId);
    else params.delete("carrier");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };

  // The hidden-login notice clears itself after a few seconds.
  useEffect(() => {
    if (!hiddenNotice) return;
    const timeout = setTimeout(() => setHiddenNotice(null), 6000);
    return () => clearTimeout(timeout);
  }, [hiddenNotice]);

  // Narrowed to the carrier filter, sorted by agent name, then carrier name
  // (the order a cleared header sort returns to). Rebuilt when logins change,
  // so an add or edit lands in place right away, or drops out if it no longer
  // matches the filter.
  const rows = useMemo<LoginRow[]>(() => {
    const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));
    const carrierNames = new Map(carriers.map((carrier) => [carrier.id, carrier.name]));
    return logins
      .filter((login) => !carrierFilter || login.carrierId === carrierFilter)
      .map((login) => ({
        login,
        agent: agentNames.get(login.agentId) ?? `Agent ${login.agentId}`,
        carrier: carrierNames.get(login.carrierId) ?? `Carrier ${login.carrierId}`,
      }))
      .sort((a, b) => a.agent.localeCompare(b.agent) || a.carrier.localeCompare(b.carrier));
  }, [logins, carrierFilter, agents, carriers]);

  const columns = useMemo<DataTableColumn<LoginRow>[]>(
    () => [
      ...COLUMNS,
      {
        id: "actions",
        header: "Actions",
        srOnlyHeader: true,
        cell: ({ login, agent, carrier }) => (
          <button
            type="button"
            onClick={() => setEditor({ mode: "edit", login })}
            className={ROW_BUTTON_CLASS}
          >
            Edit
            <span className="sr-only">
              {" "}
              {agent} at {carrier}
            </span>
          </button>
        ),
        className: "text-right",
      },
    ],
    [],
  );

  /** Adds or edits through saveLogin, then flags a login the filter hides. Returns the dialog's errors, if any. */
  const save = (values: LoginValues, editing?: LoginRecord): LoginError[] => {
    const result = saveLogin({ logins, notes, values, editing, agentName, carrierName });
    if (result.login === null) return result.errors;
    if (!result.changed) return [];

    setLogins(result.logins);
    setNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    if (!editing && carrierFilter && values.carrierId !== carrierFilter) {
      setHiddenNotice({
        message: `Login added for ${carrierName(values.carrierId)}. It's hidden by the current filter.`,
      });
    }
    return [];
  };

  // Add starts on the filtered carrier, if any.
  const addButton = (
    <button
      type="button"
      onClick={() => setEditor({ mode: "add", carrierId: carrierFilter || undefined })}
      className={PRIMARY_BUTTON_CLASS}
    >
      Add login
    </button>
  );

  return (
    <>
      <PageHeader
        title="Logins"
        actions={
          <>
            <label htmlFor={`${id}-carrier-filter`} className="sr-only">
              Filter by carrier
            </label>
            <select
              id={`${id}-carrier-filter`}
              value={carrierFilter}
              onChange={(event) => changeCarrierFilter(event.target.value)}
              className={TOOLBAR_INPUT_CLASS}
            >
              <option value="">All carriers</option>
              {[...carriers].sort(byName).map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                  {carrier.status === "inactive" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            {addButton}
          </>
        }
      />

      <UnsavedBanner count={unsavedCount} />
      <div role="status">
        {hiddenNotice ? (
          <p className="mb-4 rounded-md bg-surface-muted px-3 py-2 text-sm text-fg-muted">
            {hiddenNotice.message}
          </p>
        ) : null}
      </div>

      {logins.length === 0 ? (
        <EmptyState
          title="No logins yet"
          description="Add a login to see it listed here."
          action={addButton}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={({ login }) => login.id}
          unit={["login", "logins"]}
          searchPlaceholder="Search agent, carrier, number…"
          emptyMessage={`No logins for ${carrierName(carrierFilter)}.`}
          renderDetails={({ login }) => (
            <section className="max-w-2xl">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                Notes
              </h3>
              <NoteList
                notes={notes.filter((note) => note.loginId === login.id)}
                labels={LOGIN_FIELD_LABELS}
              />
            </section>
          )}
        />
      )}

      <LoginDialog
        editor={editor}
        agents={agents}
        carriers={carriers}
        onSave={save}
        onClose={() => setEditor(null)}
      />
    </>
  );
}
