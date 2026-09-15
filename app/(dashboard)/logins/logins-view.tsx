"use client";

import { Fragment, useEffect, useId, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
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
import type { AgentRecord } from "@/lib/agents";
import type { CarrierRecord } from "@/lib/carriers";
import { diffValues, nextId } from "@/lib/change-notes";
import type { LoginField, LoginNote, LoginRecord } from "@/lib/logins";
import { CredentialValue, PasswordInput } from "./credential-value";

/*
 * Logins table with dummy add and edit dialogs. Each login is one agent at one
 * carrier. Every add or edit records a note listing what changed (agent and
 * carrier by name); clicking an agent name expands the row to show that
 * login's notes. A carrier dropdown filters the list (?carrier=<id>). Logins
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

const COLUMNS = ["Agent", "Carrier", "Writing number", "Portal username", "Password", "Status"];

/** INPUT_CLASS without the top margin and full width, to sit beside the Add button. */
const FILTER_SELECT_CLASS =
  "block rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
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

  // Narrowed to the carrier filter, sorted by agent name, then carrier name.
  // Built from state on every render, so an add or edit lands in place right
  // away, or drops out if it no longer matches the filter.
  const rows = logins
    .filter((login) => !carrierFilter || login.carrierId === carrierFilter)
    .map((login) => ({
      login,
      agent: agentName(login.agentId),
      carrier: carrierName(login.carrierId),
    }))
    .sort((a, b) => a.agent.localeCompare(b.agent) || a.carrier.localeCompare(b.carrier));

  const toggleExpanded = (loginId: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(loginId)) next.add(loginId);
      return next;
    });

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
              className={FILTER_SELECT_CLASS}
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-4 py-6 text-center text-gray-600">
                    No logins for {carrierName(carrierFilter)}.
                  </td>
                </tr>
              ) : null}
              {rows.map(({ login, agent, carrier }) => {
                const expanded = expandedIds.has(login.id);
                const detailsId = `${id}-details-${login.id}`;

                return (
                  <Fragment key={login.id}>
                    <tr className={expanded ? "bg-gray-50" : undefined}>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(login.id)}
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
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-gray-900">{carrier}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{login.writingNumber}</td>
                      <td className="px-4 py-2.5 text-gray-600">
                        <CredentialValue value={login.username} label="username" />
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        <CredentialValue value={login.portalPassword} label="password" secret />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={login.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
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
                      </td>
                    </tr>
                    {expanded ? (
                      <tr id={detailsId} className="bg-gray-50">
                        <td colSpan={COLUMNS.length + 1} className="px-4 pb-4 pt-1">
                          <section className="max-w-2xl">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Notes
                            </h3>
                            <NoteList
                              notes={notes.filter((note) => note.loginId === login.id)}
                              labels={FIELD_LABELS}
                            />
                          </section>
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
