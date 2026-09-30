"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS, TOOLBAR_INPUT_CLASS } from "@/components/classes";
import { CredentialValue } from "@/components/credential-value";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditIcon } from "@/components/edit-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { PasswordRecord } from "@/lib/passwords";
import { byName } from "@/lib/text";
import { savePassword } from "./actions";
import {
  AGENCY_CHOICE,
  PasswordDialog,
  type AgencyOption,
  type AgentOption,
  type CarrierOption,
  type PasswordEditor,
  type PasswordError,
  type PasswordValues,
} from "./password-dialog";

/*
 * Passwords table. Each password is one agent at one carrier. Add password
 * and a row's Edit open the shared PasswordDialog (./password-dialog.tsx);
 * saves go to the API through the savePassword server action, and the API
 * records a note of what changed (agent and carrier by name, the password
 * only as set/changed). Rows don't expand. Agent and carrier dropdowns filter
 * the list (?agent=<id>, ?carrier=<id>); within them, the table sorts by
 * header and narrows by search. The list is server-loaded and kept in state so a save shows at
 * once; the action also revalidates the page, so the next render agrees.
 *
 * The agency's own passwords are listed first, with the agency in the Agent
 * column; they are added and edited here like any other. The agent
 * dropdown's Agency option (?agent=agency) shows only them.
 */

type PasswordsViewProps = {
  initialPasswords: PasswordRecord[];
  /** The agency, for its own passwords. Null when it can't be read. */
  agency: AgencyOption | null;
  agents: AgentOption[];
  carriers: CarrierOption[];
};

/** The agent filter's value for the agency's own passwords. */
const AGENCY_FILTER = AGENCY_CHOICE;

/** A table row: an agent's password, or the agency's own. */
type PasswordRow = {
  password: PasswordRecord;
  /** The agent's name, or the agency's. */
  agent: string;
  /** The agent's ID, or AGENCY_FILTER for the agency. */
  agentId: string;
  carrier: string;
};

const passwordRow = (password: PasswordRecord): PasswordRow => ({
  password,
  agent: password.agentName,
  agentId: password.agencyId ? AGENCY_FILTER : (password.agentId ?? ""),
  carrier: password.carrierName,
});

/*
 * Sort and search run in DataTable. The password is neither sortable nor
 * searchable, so typing part of one never reveals which row it belongs to.
 * The actions column is added in the view, since Edit opens its dialog.
 */
const COLUMNS: DataTableColumn<PasswordRow>[] = [
  {
    id: "agent",
    header: "Agent",
    cell: ({ agent, agentId }) =>
      agentId !== AGENCY_FILTER ? (
        agent
      ) : (
        <span className="inline-flex items-center gap-2">
          {agent}
          <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-ink">Agency</span>
        </span>
      ),
    className: "whitespace-nowrap text-fg",
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
    id: "username",
    header: "Portal username",
    cell: ({ password }) => <CredentialValue value={password.username} label="username" />,
    className: "text-fg-muted",
    sortValue: ({ password }) => password.username,
    searchText: ({ password }) => password.username,
  },
  {
    id: "password",
    header: "Password",
    cell: ({ password }) => <CredentialValue value={password.portalPassword} label="password" secret />,
    className: "text-fg-muted",
  },
  {
    id: "link",
    header: "Link",
    cell: ({ password }) =>
      password.link ? (
        <a
          href={password.link}
          target="_blank"
          rel="noopener noreferrer"
          title={password.link}
          className="block max-w-56 truncate font-medium text-fg hover:text-brand-ink hover:underline"
        >
          {password.link}
        </a>
      ) : null,
    className: "text-fg-muted",
    sortValue: ({ password }) => password.link,
    searchText: ({ password }) => password.link,
  },
  {
    id: "status",
    header: "Status",
    cell: ({ password }) => <StatusBadge status={password.status} />,
    sortValue: ({ password }) => statusRank(password.status),
    searchText: ({ password }) => password.status,
  },
];

export function PasswordsView({ initialPasswords, agency, agents, carriers }: PasswordsViewProps) {
  const [passwords, setPasswords] = useState(initialPasswords);
  const [editor, setEditor] = useState<PasswordEditor | null>(null);
  // Shown when Add saves a password the filters hide. Each add
  // sets a new object, so a second hidden add restarts the timer even with
  // the same message.
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
  // Agent ID to filter by, AGENCY_FILTER for the agency's logins, or "" for
  // everyone. Seeded from ?agent= the same way.
  const [agentFilter, setAgentFilter] = useState(() => {
    const agentId = searchParams.get("agent") ?? "";
    if (agentId === AGENCY_FILTER) return agency ? agentId : "";
    return agents.some((agent) => agent.id === agentId) ? agentId : "";
  });

  const carrierName = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.name ?? `Carrier ${carrierId}`;
  const agentName = (agentId: string) =>
    agentId === AGENCY_FILTER
      ? "the agency"
      : (agents.find((agent) => agent.id === agentId)?.name ?? `Agent ${agentId}`);

  // State drives the selects, so they change on this render; replaceState keeps
  // the choice in the URL without a reload or refetch. "All" drops the param.
  const setFilterParam = (param: "agent" | "carrier", value: string) => {
    setHiddenNotice(null);
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(param, value);
    else params.delete(param);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };
  const changeCarrierFilter = (carrierId: string) => {
    setCarrierFilter(carrierId);
    setFilterParam("carrier", carrierId);
  };
  const changeAgentFilter = (agentId: string) => {
    setAgentFilter(agentId);
    setFilterParam("agent", agentId);
  };

  // What the filters narrow to, for the empty-table message.
  const filterLabel = [agentFilter && agentName(agentFilter), carrierFilter && carrierName(carrierFilter)]
    .filter(Boolean)
    .join(" at ");

  // The hidden-record notice clears itself after a few seconds.
  useEffect(() => {
    if (!hiddenNotice) return;
    const timeout = setTimeout(() => setHiddenNotice(null), 6000);
    return () => clearTimeout(timeout);
  }, [hiddenNotice]);

  // Narrowed to the agent and carrier filters: the agency's logins first, then
  // by agent name, then carrier name (the order a cleared header sort returns to). Rebuilt when passwords
  // change, so an add or edit lands in place right away, or drops out if it
  // no longer matches the filter.
  // Names come with each record from the API, as of its read.
  const rows = useMemo<PasswordRow[]>(
    () =>
      passwords
        .map(passwordRow)
        .filter((row) => !agentFilter || row.agentId === agentFilter)
        .filter((row) => !carrierFilter || row.password.carrierId === carrierFilter)
        .sort(
          (a, b) =>
            Number(a.agentId !== AGENCY_FILTER) - Number(b.agentId !== AGENCY_FILTER) ||
            a.agent.localeCompare(b.agent) ||
            a.carrier.localeCompare(b.carrier),
        ),
    [passwords, agentFilter, carrierFilter],
  );

  const columns = useMemo<DataTableColumn<PasswordRow>[]>(
    () => [
      {
        id: "actions",
        header: "Action",
        cell: ({ password, agent, carrier }) => (
          <button
            type="button"
            onClick={() => setEditor({ mode: "edit", password })}
            className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
          >
            <EditIcon className="size-3.5 shrink-0" />
            <span className="sr-only">
              {" "}
              {agent} at {carrier}
            </span>
          </button>
        ),
      },
      ...COLUMNS,
    ],
    [],
  );

  /** Adds or edits through the API, then flags a record the filter hides. Resolves with the dialog's errors. */
  const save = async (values: PasswordValues, editing?: PasswordRecord): Promise<PasswordError[]> => {
    const result = await savePassword(values, editing?.id);
    if (!result.ok) return result.errors;

    const saved = result.password;
    setPasswords((current) =>
      editing ? current.map((record) => (record.id === saved.id ? saved : record)) : [...current, saved],
    );
    const party = values.agencyId ? AGENCY_FILTER : (values.agentId ?? "");
    const hidden = (agentFilter && party !== agentFilter) || (carrierFilter && values.carrierId !== carrierFilter);
    if (!editing && hidden) {
      setHiddenNotice({
        message: `Password added for ${agentName(party)} at ${carrierName(values.carrierId)}. It's hidden by the current filters.`,
      });
    }
    return [];
  };

  // Add starts on the filtered agent and carrier, if any.
  const addButton = (
    <button
      type="button"
      onClick={() =>
        setEditor({
          mode: "add",
          agentId: agentFilter || undefined,
          carrierId: carrierFilter || undefined,
        })
      }
      className={PRIMARY_BUTTON_CLASS}
    >
      Add password
    </button>
  );

  return (
    <>
      <PageHeader
        title="Passwords"
        actions={
          <>
            <label htmlFor={`${id}-agent-filter`} className="sr-only">
              Filter by agent
            </label>
            <select
              id={`${id}-agent-filter`}
              value={agentFilter}
              onChange={(event) => changeAgentFilter(event.target.value)}
              className={TOOLBAR_INPUT_CLASS}
            >
              <option value="">All agents</option>
              {agency ? <option value={AGENCY_FILTER}>Agency</option> : null}
              {[...agents].sort(byName).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                  {agent.status === "inactive" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
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

      <div role="status">
        {hiddenNotice ? (
          <p className="mb-4 rounded-md bg-surface-muted px-3 py-2 text-sm text-fg-muted">
            {hiddenNotice.message}
          </p>
        ) : null}
      </div>

      {passwords.length === 0 ? (
        <EmptyState
          title="No passwords yet"
          description="Add a password to see it listed here."
          action={addButton}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={({ password }) => password.id}
          unit={["password", "passwords"]}
          emptyMessage={`No passwords for ${filterLabel}.`}
        />
      )}

      <PasswordDialog
        editor={editor}
        agents={agents}
        carriers={carriers}
        agency={agency}
        onSave={save}
        onClose={() => setEditor(null)}
      />
    </>
  );
}
