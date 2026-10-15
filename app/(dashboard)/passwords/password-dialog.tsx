"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS, TOOLBAR_INPUT_CLASS } from "@/components/classes";
import { PasswordInput } from "@/components/credential-value";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { PROFILE_BUTTON_CLASS } from "@/components/profile-shell";
import type { PasswordRecord, PasswordStatus } from "@/lib/passwords";
import type { SitePasswordRecord, SiteRecord } from "@/lib/site-passwords";
import { byName } from "@/lib/text";
import { savePassword } from "./actions";
import { AGENCY_CHOICE, type AgencyOption, type AgentOption, type CarrierOption } from "./password-form";
import { saveSitePassword } from "./site-actions";
import { SiteDialog, type SiteEditor } from "./site-dialog";

/*
 * The one Add / Edit password popup, for both kinds: a carrier password
 * (Carrier select) or a site password (Site select, with "+ Add site" /
 * "Edit site" opening SiteDialog on top). Same fields and layout either way:
 * Status at the top right beside the title, then Agent and Carrier / Site,
 * Portal username and Portal password. A site's link is changed through
 * "Edit site", not here. While the status is Pending, username and password
 * are optional (the login isn't issued yet).
 *
 * Opened from the Passwords page's Add buttons and row Edits, and the agent
 * profile's (agent fixed). An editor with `password` set edits that password,
 * every field filled in from it. Saves go through
 * savePassword (./actions.ts) or saveSitePassword (./site-actions.ts), which
 * revalidate the dashboard; `onSaved` runs before the popup closes so the
 * caller can refresh.
 *
 * For an agent, the carrier select offers only carriers open to agents
 * (agentAccessible); the agency's own password can be at any carrier.
 */

export type PasswordKind = "carrier" | "site";

/** Which popup is open, and what it starts on. */
export type AddPasswordEditor = {
  kind: PasswordKind;
  /** Edit: the password to change, a carrier or site one to match `kind`. Leave out to add. */
  password?: PasswordRecord | SitePasswordRecord;
  /** An agent's ID, or AGENCY_CHOICE. */
  agentId?: string;
  /** Carrier passwords only. */
  carrierId?: string;
  /** Site passwords only. */
  siteId?: string;
};

type AddPasswordDialogProps = {
  /** Null keeps the popup closed. */
  editor: AddPasswordEditor | null;
  agents: AgentOption[];
  /** The agency, offered first in the agent select. Null leaves it out. */
  agency: AgencyOption | null;
  /** For carrier passwords. */
  carriers: CarrierOption[];
  /** For site passwords. */
  sites?: SiteRecord[];
  /** Offer "+ Add site" / "Edit site" under the Site select. Off on the agent profile. */
  manageSites?: boolean;
  onSaved: () => void;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function AddPasswordDialog({ editor, onClose, ...props }: AddPasswordDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose} className="max-w-3xl overflow-y-auto">
      {editor ? <AddPasswordForm id={id} editor={editor} close={close} {...props} /> : null}
    </ModalDialog>
  );
}

type FormError = { field: "agent" | "place" | "username" | "password" | "form"; message: string };

/** The save action's field -> this form's field. */
const ERROR_FIELDS: Record<string, FormError["field"]> = {
  agentId: "agent",
  carrierId: "place",
  siteId: "place",
  username: "username",
  portalPassword: "password",
};

type AddPasswordFormProps = Omit<AddPasswordDialogProps, "editor" | "onClose"> & {
  id: string;
  editor: AddPasswordEditor;
  close: () => void;
};

function AddPasswordForm({
  id,
  editor,
  agents,
  agency,
  carriers,
  sites: initialSites = [],
  manageSites = true,
  onSaved,
  close,
}: AddPasswordFormProps) {
  const isSite = editor.kind === "site";
  const editing = editor.password;
  // On Edit, the password's own agent and carrier / site.
  const startAgentId = editing ? (editing.agencyId ? AGENCY_CHOICE : (editing.agentId ?? "")) : editor.agentId;
  const startPlaceId = editing
    ? "carrierId" in editing
      ? editing.carrierId
      : editing.siteId
    : isSite
      ? editor.siteId
      : editor.carrierId;
  const defaultAgentId =
    startAgentId === AGENCY_CHOICE
      ? agency
        ? AGENCY_CHOICE
        : ""
      : agents.some((agent) => agent.id === startAgentId)
        ? (startAgentId ?? "")
        : // The agent profile passes its one agent: start on it.
          agents.length === 1
          ? agents[0].id
          : "";

  const [errors, setErrors] = useState<FormError[]>([]);
  const [saving, setSaving] = useState(false);
  const [forAgency, setForAgency] = useState(defaultAgentId === AGENCY_CHOICE);
  // Pending: the login isn't issued yet, so username and password may be blank.
  const [statusValue, setStatusValue] = useState<PasswordStatus>(editing?.status ?? "active");
  const pending = statusValue === "pending";

  // An edited password's own carrier stays offered, open to agents or not.
  const carrierOptions = [...carriers]
    .filter((carrier) => forAgency || carrier.agentAccessible || carrier.id === startPlaceId)
    .sort(byName);
  // Sites added or edited on top join the list, so the select is controlled.
  const [sites, setSites] = useState(initialSites);
  const [placeId, setPlaceId] = useState(() =>
    isSite
      ? initialSites.some((site) => site.id === startPlaceId)
        ? (startPlaceId ?? "")
        : ""
      : carrierOptions.some((carrier) => carrier.id === startPlaceId)
        ? (startPlaceId ?? "")
        : "",
  );
  const [siteEditor, setSiteEditor] = useState<SiteEditor | null>(null);
  const chosenSite = isSite ? sites.find((site) => site.id === placeId) : undefined;

  const messageFor = (field: FormError["field"]) => errors.find((error) => error.field === field)?.message ?? null;
  const clear = (...fields: FormError["field"][]) =>
    setErrors((current) => current.filter((error) => !fields.includes(error.field)));
  const agentError = messageFor("agent");
  const placeError = messageFor("place");
  const usernameError = messageFor("username");
  const passwordError = messageFor("password");
  const formError = messageFor("form");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const agentChoice = String(data.get("agentId") ?? "");
    const party = {
      agentId: agentChoice === AGENCY_CHOICE ? null : agentChoice,
      agencyId: agentChoice === AGENCY_CHOICE && agency ? agency.id : null,
    };
    const username = String(data.get("username") ?? "").trim();
    // Not trimmed or lowercased: spaces and case can matter in a password.
    const portalPassword = String(data.get("portalPassword") ?? "");
    if (!pending && portalPassword.trim() === "") {
      setErrors([{ field: "password", message: "Password can't be blank." }]);
      return;
    }
    setSaving(true);
    try {
      const credentials = { username, portalPassword, status: statusValue };
      const result = isSite
        ? await saveSitePassword({ ...party, siteId: placeId, ...credentials }, editing?.id)
        : await savePassword({ ...party, carrierId: placeId, ...credentials }, editing?.id);
      if (!result.ok) {
        setErrors(result.errors.map((error) => ({ field: ERROR_FIELDS[error.field] ?? "form", message: error.message })));
        return;
      }
      onSaved();
      close();
    } finally {
      setSaving(false);
    }
  };

  const placeLabel = isSite ? "Site" : "Carrier";

  return (
    <>
      <form onSubmit={handleSubmit} className="p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
            {editing
              ? `Edit ${editing.agentName} at ${"carrierName" in editing ? editing.carrierName : editing.siteName}`
              : isSite
                ? "Add site password"
                : "Add carrier password"}
          </h2>
          {/* Status is a setting, not a detail: top right, like the pages' card headers. */}
          <label htmlFor={`${id}-status`} className="flex items-center gap-2 text-sm text-fg-muted">
            Status
            <select
              id={`${id}-status`}
              name="status"
              value={statusValue}
              onChange={(event) => {
                setStatusValue(event.target.value as PasswordStatus);
                clear("username", "password");
              }}
              className={`${TOOLBAR_INPUT_CLASS} py-1 pr-7 text-fg`}
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Agent" required htmlFor={`${id}-agent`} hint={agentError ?? undefined} hintId={`${id}-agent-error`} error>
            <select
              id={`${id}-agent`}
              name="agentId"
              required
              defaultValue={defaultAgentId}
              aria-invalid={agentError ? true : undefined}
              aria-describedby={agentError ? `${id}-agent-error` : undefined}
              onChange={(event) => {
                const toAgency = event.target.value === AGENCY_CHOICE;
                setForAgency(toAgency);
                // A carrier closed to agents can't stay chosen for one.
                if (!isSite && !toAgency && !carriers.find((carrier) => carrier.id === placeId)?.agentAccessible) {
                  setPlaceId("");
                }
                clear("agent", "place");
              }}
              className={INPUT_CLASS}
            >
              {agents.length === 1 && !agency ? null : <option value="">Choose an agent</option>}
              {agency ? <option value={AGENCY_CHOICE}>{agency.name} (agency)</option> : null}
              {[...agents].sort(byName).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                  {agent.status === "inactive" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={placeLabel}
            required
            htmlFor={`${id}-place`}
            hint={placeError ?? undefined}
            hintId={`${id}-place-error`}
            error
          >
            <select
              id={`${id}-place`}
              name={isSite ? "siteId" : "carrierId"}
              required
              value={placeId}
              aria-invalid={placeError ? true : undefined}
              aria-describedby={placeError ? `${id}-place-error` : undefined}
              onChange={(event) => {
                setPlaceId(event.target.value);
                clear("place");
              }}
              className={INPUT_CLASS}
            >
              <option value="">{isSite ? "Choose a site" : "Choose a carrier"}</option>
              {isSite
                ? [...sites].sort(byName).map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))
                : carrierOptions.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                      {carrier.status === "inactive" ? " (inactive)" : ""}
                    </option>
                  ))}
            </select>
            {isSite && manageSites ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setSiteEditor({ mode: "add" })} className={PROFILE_BUTTON_CLASS}>
                  <span aria-hidden="true">+ </span>Add site
                </button>
                {chosenSite ? (
                  <button
                    type="button"
                    onClick={() => setSiteEditor({ mode: "edit", site: chosenSite })}
                    className={PROFILE_BUTTON_CLASS}
                  >
                    Edit site<span className="sr-only"> {chosenSite.name}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </Field>

          <Field
            label="Portal username"
            required={!pending}
            htmlFor={`${id}-username`}
            hint={usernameError ?? undefined}
            hintId={`${id}-username-error`}
            error
          >
            <input
              id={`${id}-username`}
              name="username"
              type="text"
              required={!pending}
              pattern=".*\S.*"
              autoComplete="off"
              defaultValue={editing?.username}
              aria-invalid={usernameError ? true : undefined}
              aria-describedby={usernameError ? `${id}-username-error` : undefined}
              onChange={() => clear("username")}
              className={INPUT_CLASS}
            />
          </Field>
          <Field
            label="Portal password"
            required={!pending}
            htmlFor={`${id}-password`}
            hint={passwordError ?? undefined}
            hintId={`${id}-password-error`}
            error
          >
            {/* Spaces are kept; all-spaces is rejected on submit unless pending. new-password stops the
                browser filling in the signed-in user's own saved password. */}
            <PasswordInput
              id={`${id}-password`}
              name="portalPassword"
              required={!pending}
              autoComplete="new-password"
              spellCheck={false}
              defaultValue={editing?.portalPassword}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? `${id}-password-error` : undefined}
              onChange={() => clear("password")}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        {/* Errors about the attempt itself (no permission, API down), not one field. */}
        <div role="alert" className="mt-4">
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={close} disabled={saving} className={GHOST_BUTTON_CLASS}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add password"}
          </button>
        </div>
      </form>

      {/* Outside the form above: a dialog's form can't nest in it. Opens on top of this popup. */}
      {isSite && manageSites ? (
        <SiteDialog
          editor={siteEditor}
          onSaved={(saved) => {
            const next = [...sites.filter((site) => site.id !== saved.id), saved];
            setSites(next);
            setPlaceId(saved.id);
            clear("place");
          }}
          onClose={() => setSiteEditor(null)}
        />
      ) : null}
    </>
  );
}
