"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  GHOST_BUTTON_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  ROW_BUTTON_CLASS,
  TOOLBAR_INPUT_CLASS,
} from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { NoteList } from "@/components/note-list";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { AgentRecord } from "@/lib/agents";
import type { CarrierRecord } from "@/lib/carriers";
import { diffValues, nextId } from "@/lib/change-notes";
import type { LoginField, LoginNote, LoginRecord } from "@/lib/logins";
import { CredentialValue, PasswordInput } from "./credential-value";

/*
 * Logins table with dummy add and edit dialogs. Each login is one agent at one
 * carrier. Every add or edit records a note listing what changed (agent and
 * carrier by name); clicking an agent name expands the row to show that
 * login's notes. A carrier dropdown filters the list (?carrier=<id>); within
 * it, the table sorts by header and narrows by search. Logins
 * and notes live in component state only: nothing reaches a server, and a
 * refresh brings back the JSON.
 */

type AgentOption = Pick<AgentRecord, "id" | "name" | "status">;
type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status">;

type LoginsViewProps = {
  initialLogins: LoginRecord[];
  initialNotes: LoginNote[];
  agents: AgentOption[];
  carriers: CarrierOption[];
};

/** Which dialog is open. Edit holds the login as it was when the dialog opened. */
type Editor = { mode: "add" } | { mode: "edit"; login: LoginRecord };

type LoginValues = Omit<LoginRecord, "id">;

/** Also the order changes are compared and listed in. */
const FIELD_LABELS: Record<LoginField, string> = {
  agentId: "Agent",
  carrierId: "Carrier",
  writingNumber: "Writing number",
  username: "Portal username",
  portalPassword: "Password",
  status: "Status",
};

const FIELDS = Object.keys(FIELD_LABELS) as LoginField[];

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
        className="-ml-1 flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 text-gray-900 hover:bg-gray-100"
      >
        {agent}
        <span className="sr-only"> at {carrier}</span>
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
    ),
    sortValue: ({ agent }) => agent,
    searchText: ({ agent }) => agent,
  },
  {
    id: "carrier",
    header: "Carrier",
    cell: ({ carrier }) => carrier,
    className: "whitespace-nowrap text-gray-900",
    sortValue: ({ carrier }) => carrier,
    searchText: ({ carrier }) => carrier,
  },
  {
    id: "writingNumber",
    header: "Writing number",
    cell: ({ login }) => login.writingNumber,
    className: "font-mono text-gray-600",
    sortValue: ({ login }) => login.writingNumber,
    searchText: ({ login }) => login.writingNumber,
  },
  {
    id: "username",
    header: "Portal username",
    cell: ({ login }) => <CredentialValue value={login.username} label="username" />,
    className: "text-gray-600",
    sortValue: ({ login }) => login.username,
    searchText: ({ login }) => login.username,
  },
  {
    id: "password",
    header: "Password",
    cell: ({ login }) => <CredentialValue value={login.portalPassword} label="password" secret />,
    className: "text-gray-600",
  },
  {
    id: "status",
    header: "Status",
    cell: ({ login }) => <StatusBadge status={login.status} />,
    sortValue: ({ login }) => statusRank(login.status),
    searchText: ({ login }) => login.status,
  },
];

const EMPTY_VALUES = { agentId: "", carrierId: "", writingNumber: "", username: "", portalPassword: "" };

/** Recorded in notes only as "Password changed", never with its value. */
const REDACTED_FIELDS: LoginField[] = ["portalPassword"];

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export function LoginsView({ initialLogins, initialNotes, agents, carriers }: LoginsViewProps) {
  const [logins, setLogins] = useState(initialLogins);
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [carrierError, setCarrierError] = useState<string | null>(null);
  const [writingNumberError, setWritingNumberError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Shown when Add saves a login the carrier filter hides. Keyed by login, so a
  // second hidden add restarts the timer even with the same message.
  const [hiddenNotice, setHiddenNotice] = useState<{ loginId: string; message: string } | null>(
    null,
  );
  const { dialogRef, close: closeDialog } = useModalDialog(editor !== null);
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

  /** Values as notes show them: agent and carrier by name. */
  const shownValues = (values: LoginValues) => ({
    ...values,
    agentId: agentName(values.agentId),
    carrierId: carrierName(values.carrierId),
  });

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

  // Runs for every close: Cancel, Escape, backdrop click, or a save. Clearing
  // the editor unmounts the form, which resets it.
  const handleClose = () => {
    setEditor(null);
    setCarrierError(null);
    setWritingNumberError(null);
    setPasswordError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;

    const data = new FormData(event.currentTarget);
    const text = (field: LoginField) => String(data.get(field) ?? "").trim();
    const status = text("status");
    const values: LoginValues = {
      agentId: text("agentId"),
      carrierId: text("carrierId"),
      writingNumber: text("writingNumber"),
      username: text("username"),
      // Not trimmed or lowercased: spaces and case can matter in a password.
      portalPassword: String(data.get("portalPassword") ?? ""),
      status: status === "pending" || status === "inactive" ? status : "active",
    };

    // One login per agent per carrier, and a writing number can't repeat
    // within a carrier (ignoring case).
    const editingId = editor.mode === "edit" ? editor.login.id : null;
    const others = logins.filter((login) => login.id !== editingId);
    const pairOwner = others.find(
      (login) => login.agentId === values.agentId && login.carrierId === values.carrierId,
    );
    const numberKey = values.writingNumber.toLowerCase();
    const numberOwner = others.find(
      (login) =>
        login.carrierId === values.carrierId && login.writingNumber.toLowerCase() === numberKey,
    );
    // Messages name agents and carriers, never IDs.
    const carrierMessage = pairOwner
      ? `${agentName(values.agentId)} already has a login at ${carrierName(values.carrierId)}.`
      : null;
    // Skip when it's the same login the carrier error already names. The number
    // is shown as stored, which may differ in case from what was typed.
    const numberMessage =
      numberOwner && numberOwner !== pairOwner
        ? `Writing number ${numberOwner.writingNumber} is already used at ${carrierName(values.carrierId)} by ${agentName(numberOwner.agentId)}.`
        : null;
    // Required, and spaces alone don't count. A valid password is still saved as typed.
    const passwordMessage = values.portalPassword.trim() === "" ? "Password can't be blank." : null;
    setCarrierError(carrierMessage);
    setWritingNumberError(numberMessage);
    setPasswordError(passwordMessage);
    if (carrierMessage || numberMessage || passwordMessage) return;

    const loginId = editingId ?? nextId(logins);
    const changes = diffValues(
      FIELDS,
      editor.mode === "edit" ? shownValues(editor.login) : EMPTY_VALUES,
      shownValues(values),
      REDACTED_FIELDS,
    );

    // Saving an edit with nothing changed just closes, without a note.
    if (changes.length > 0) {
      setLogins((current) =>
        editor.mode === "edit"
          ? current.map((login) => (login.id === loginId ? { id: loginId, ...values } : login))
          : [...current, { id: loginId, ...values }],
      );
      setNotes((current) => [
        {
          id: nextId(current),
          loginId,
          kind: editor.mode === "edit" ? "edited" : "added",
          createdAt: new Date().toISOString(),
          changes,
        },
        ...current,
      ]);
      setUnsavedCount((count) => count + 1);
      if (editor.mode === "add" && carrierFilter && values.carrierId !== carrierFilter) {
        setHiddenNotice({
          loginId,
          message: `Login added for ${carrierName(values.carrierId)}. It's hidden by the current filter.`,
        });
      }
    }
    closeDialog();
  };

  const addButton = (
    <button type="button" onClick={() => setEditor({ mode: "add" })} className={PRIMARY_BUTTON_CLASS}>
      Add login
    </button>
  );

  const editing = editor?.mode === "edit" ? editor.login : undefined;

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

      <div role="status">
        {unsavedCount > 0 ? (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {unsavedCount === 1 ? "1 change" : `${unsavedCount} changes`} made on this page only.
            Nothing is saved yet, so refreshing undoes {unsavedCount === 1 ? "it" : "them"}.
          </p>
        ) : null}
        {hiddenNotice ? (
          <p className="mb-4 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
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
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Notes
              </h3>
              <NoteList
                notes={notes.filter((note) => note.loginId === login.id)}
                labels={FIELD_LABELS}
              />
            </section>
          )}
        />
      )}

      <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={handleClose}>
        {editor ? (
          <form onSubmit={handleSubmit} className="p-6">
            <h2 id={`${id}-title`} className="text-base font-semibold text-gray-900">
              {editing
                ? `Edit ${agentName(editing.agentId)} at ${carrierName(editing.carrierId)}`
                : "Add login"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {editing
                ? "Saving records a note of what changed. Nothing is saved anywhere yet; refreshing undoes it."
                : "Not saved anywhere yet. The login stays in the list until you refresh."}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Agent" htmlFor={`${id}-agent`}>
                <select
                  id={`${id}-agent`}
                  name="agentId"
                  required
                  defaultValue={editing?.agentId ?? ""}
                  onChange={() => setCarrierError(null)}
                  className={INPUT_CLASS}
                >
                  <option value="">Choose an agent</option>
                  {[...agents].sort(byName).map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                      {agent.status === "inactive" ? " (inactive)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Carrier"
                htmlFor={`${id}-carrier`}
                hint={carrierError ?? undefined}
                hintId={`${id}-carrier-error`}
                error
              >
                <select
                  id={`${id}-carrier`}
                  name="carrierId"
                  required
                  defaultValue={editing ? editing.carrierId : carrierFilter}
                  aria-invalid={carrierError ? true : undefined}
                  aria-describedby={carrierError ? `${id}-carrier-error` : undefined}
                  onChange={() => {
                    setCarrierError(null);
                    setWritingNumberError(null);
                  }}
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
              <Field
                label="Writing number"
                htmlFor={`${id}-writing-number`}
                hint={writingNumberError ?? undefined}
                hintId={`${id}-writing-number-error`}
                error
              >
                <input
                  id={`${id}-writing-number`}
                  name="writingNumber"
                  type="text"
                  required
                  pattern=".*\S.*"
                  autoComplete="off"
                  defaultValue={editing?.writingNumber}
                  aria-invalid={writingNumberError ? true : undefined}
                  aria-describedby={writingNumberError ? `${id}-writing-number-error` : undefined}
                  onChange={() => setWritingNumberError(null)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field
                label="Portal username"
                htmlFor={`${id}-username`}
                hint="Portal login for this agent at this carrier."
                hintId={`${id}-username-hint`}
              >
                <input
                  id={`${id}-username`}
                  name="username"
                  type="text"
                  required
                  pattern=".*\S.*"
                  autoComplete="off"
                  aria-describedby={`${id}-username-hint`}
                  defaultValue={editing?.username}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field
                label="Portal password"
                htmlFor={`${id}-password`}
                hint={passwordError ?? undefined}
                hintId={`${id}-password-error`}
                error
              >
                {/* Spaces are kept; all-spaces is rejected on submit. new-password stops the
                    browser filling in the signed-in user's own saved password. */}
                <PasswordInput
                  id={`${id}-password`}
                  name="portalPassword"
                  required
                  autoComplete="new-password"
                  spellCheck={false}
                  defaultValue={editing?.portalPassword}
                  aria-invalid={passwordError ? true : undefined}
                  aria-describedby={passwordError ? `${id}-password-error` : undefined}
                  onChange={() => setPasswordError(null)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Status" htmlFor={`${id}-status`}>
                <select
                  id={`${id}-status`}
                  name="status"
                  defaultValue={editing?.status ?? "active"}
                  className={INPUT_CLASS}
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeDialog} className={GHOST_BUTTON_CLASS}>
                Cancel
              </button>
              <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                {editing ? "Save changes" : "Add login"}
              </button>
            </div>
          </form>
        ) : null}
      </ModalDialog>
    </>
  );
}
