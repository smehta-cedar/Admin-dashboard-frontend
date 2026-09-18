"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS, TOOLBAR_INPUT_CLASS } from "@/components/classes";
import { CredentialValue } from "@/components/credential-value";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import { UnsavedBanner } from "@/components/unsaved-banner";
import type { PasswordNote, PasswordRecord } from "@/lib/passwords";
import { byName } from "@/lib/text";
import {
  PasswordDialog,
  savePassword,
  type AgentOption,
  type CarrierOption,
  type PasswordEditor,
  type PasswordError,
  type PasswordValues,
} from "./password-dialog";

/*
 * Passwords table with dummy add and edit. Each password is one
 * agent at one carrier. Add password and a row's Edit open the shared
 * PasswordDialog (./password-dialog.tsx: `PasswordDialog` + pure
 * `savePassword`, the same shape as the other entity dialogs); every add
 * or edit records a note listing what changed (agent and carrier by name),
 * notes stay in state for the change log but rows don't expand. A carrier
 * dropdown filters the list (?carrier=<id>); within it, the table sorts by
 * header and narrows by search. Passwords and notes live in component state
 * only: nothing reaches a server, and a refresh brings back the JSON.
 */

type PasswordsViewProps = {
  initialPasswords: PasswordRecord[];
  initialNotes: PasswordNote[];
  agents: AgentOption[];
  carriers: CarrierOption[];
};

/** A table row: the password with its agent and carrier names looked up. */
type PasswordRow = {
  password: PasswordRecord;
  agent: string;
  carrier: string;
};

/*
 * Sort and search run in DataTable. The password is neither sortable nor
 * searchable, so typing part of one never reveals which row it belongs to.
 * The actions column is added in the view, since Edit opens its dialog.
 */
const COLUMNS: DataTableColumn<PasswordRow>[] = [
  {
    id: "agent",
    header: "Agent",
    cell: ({ agent }) => agent,
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
    cell: ({ password }) => (
      <CredentialValue value={password.username} label="username" />
    ),
    className: "text-fg-muted",
    sortValue: ({ password }) => password.username,
    searchText: ({ password }) => password.username,
  },
  {
    id: "password",
    header: "Password",
    cell: ({ password }) => (
      <CredentialValue value={password.portalPassword} label="password" secret />
    ),
    className: "text-fg-muted",
  },
  {
    id: "status",
    header: "Status",
    cell: ({ password }) => <StatusBadge status={password.status} />,
    sortValue: ({ password }) => statusRank(password.status),
    searchText: ({ password }) => password.status,
  },
];

export function PasswordsView({
  initialPasswords,
  initialNotes,
  agents,
  carriers,
}: PasswordsViewProps) {
  const [passwords, setPasswords] = useState(initialPasswords);
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<PasswordEditor | null>(null);
  // Shown when Add saves a password the carrier filter hides. Each add
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

  // The hidden-record notice clears itself after a few seconds.
  useEffect(() => {
    if (!hiddenNotice) return;
    const timeout = setTimeout(() => setHiddenNotice(null), 6000);
    return () => clearTimeout(timeout);
  }, [hiddenNotice]);

  // Narrowed to the carrier filter, sorted by agent name, then carrier name
  // (the order a cleared header sort returns to). Rebuilt when passwords
  // change, so an add or edit lands in place right away, or drops out if it
  // no longer matches the filter.
  const rows = useMemo<PasswordRow[]>(() => {
    const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));
    const carrierNames = new Map(carriers.map((carrier) => [carrier.id, carrier.name]));
    return passwords
      .filter((record) => !carrierFilter || record.carrierId === carrierFilter)
      .map((password) => ({
        password,
        agent: agentNames.get(password.agentId) ?? `Agent ${password.agentId}`,
        carrier: carrierNames.get(password.carrierId) ?? `Carrier ${password.carrierId}`,
      }))
      .sort((a, b) => a.agent.localeCompare(b.agent) || a.carrier.localeCompare(b.carrier));
  }, [passwords, carrierFilter, agents, carriers]);

  const columns = useMemo<DataTableColumn<PasswordRow>[]>(
    () => [
      ...COLUMNS,
      {
        id: "actions",
        header: "Actions",
        srOnlyHeader: true,
        cell: ({ password, agent, carrier }) => (
          <button
            type="button"
            onClick={() => setEditor({ mode: "edit", password })}
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

  /** Adds or edits through savePassword, then flags a record the filter hides. */
  const save = (
    values: PasswordValues,
    editing?: PasswordRecord,
  ): PasswordError[] => {
    const result = savePassword({
      passwords,
      notes,
      values,
      editing,
      agentName,
      carrierName,
    });
    if (result.password === null) return result.errors;
    if (!result.changed) return [];

    setPasswords(result.passwords);
    setNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    if (!editing && carrierFilter && values.carrierId !== carrierFilter) {
      setHiddenNotice({
        message: `Password added for ${carrierName(values.carrierId)}. It's hidden by the current filter.`,
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
      Add password
    </button>
  );

  return (
    <>
      <PageHeader
        title="Passwords"
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
          searchPlaceholder="Search agent, carrier, username…"
          emptyMessage={`No passwords for ${carrierName(carrierFilter)}.`}
        />
      )}

      <PasswordDialog
        editor={editor}
        agents={agents}
        carriers={carriers}
        onSave={save}
        onClose={() => setEditor(null)}
      />
    </>
  );
}
