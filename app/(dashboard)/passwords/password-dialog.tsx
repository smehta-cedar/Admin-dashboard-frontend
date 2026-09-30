"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { PasswordInput } from "@/components/credential-value";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import type { AgentRecord } from "@/lib/agents";
import type { CarrierRecord } from "@/lib/carriers";
import type { PasswordError, PasswordField, PasswordRecord, PasswordValues } from "@/lib/passwords";
import { byName } from "@/lib/text";

/*
 * The one Add / Edit password dialog: agent (or the agency), carrier, portal
 * username and password, link, status. Writing numbers live on carrier contracts. The
 * Passwords page opens it from Add password (the agent and carrier pre-picked
 * from its filters) and a row's Edit.
 *
 * The view passes `onSave`, which calls the savePassword server action
 * (./actions.ts) and updates its own state from the saved record. The API
 * keeps one password per agent at each carrier and records the change note;
 * the form only checks what it can see at once (a blank password). While
 * the save is in flight the buttons are disabled.
 *
 * For an agent, the carrier select offers only carriers open to agents
 * (agentAccessible: the agency's contract with them has a contract number),
 * plus an edited password's own carrier so it stays the current choice. The
 * agency's own password can be at any carrier.
 */

/** The agent select's value for the agency's own password. */
export const AGENCY_CHOICE = "agency";

/** Which dialog is open. Add may start on an agent (or AGENCY_CHOICE) and a carrier; edit holds the record as it was. */
export type PasswordEditor =
  | { mode: "add"; agentId?: string; carrierId?: string }
  | { mode: "edit"; password: PasswordRecord };

export type { PasswordError, PasswordValues } from "@/lib/passwords";

export type AgentOption = Pick<AgentRecord, "id" | "name" | "status">;
export type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status" | "agentAccessible">;
export type AgencyOption = { id: string; name: string };

/** Also the order changes are listed in on a note. */
export const PASSWORD_FIELD_LABELS: Record<PasswordField, string> = {
  agentId: "Agent",
  agencyId: "Agency",
  carrierId: "Carrier",
  username: "Portal username",
  portalPassword: "Password",
  link: "Link",
  status: "Status",
};

type PasswordDialogProps = {
  /** Null keeps the dialog closed. */
  editor: PasswordEditor | null;
  agents: AgentOption[];
  carriers: CarrierOption[];
  /** The agency, offered first in the agent select. Null leaves it out. */
  agency: AgencyOption | null;
  /** Saves the values; resolves with the errors to show instead of closing. */
  onSave: (values: PasswordValues, editing?: PasswordRecord) => Promise<PasswordError[]>;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function PasswordDialog({
  editor,
  agents,
  carriers,
  agency,
  onSave,
  onClose,
}: PasswordDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? (
        <PasswordForm
          id={id}
          editor={editor}
          agents={agents}
          carriers={carriers}
          agency={agency}
          onSave={onSave}
          close={close}
        />
      ) : null}
    </ModalDialog>
  );
}

type PasswordFormProps = Omit<PasswordDialogProps, "editor" | "onClose"> & {
  id: string;
  editor: PasswordEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function PasswordForm({
  id,
  editor,
  agents,
  carriers,
  agency,
  onSave,
  close,
}: PasswordFormProps) {
  const editing = editor.mode === "edit" ? editor.password : undefined;
  const presetAgentId = editing
    ? editing.agencyId
      ? AGENCY_CHOICE
      : (editing.agentId ?? "")
    : editor.mode === "add"
      ? (editor.agentId ?? "")
      : "";
  const defaultAgentId = presetAgentId === AGENCY_CHOICE && !agency ? "" : presetAgentId;
  const [errors, setErrors] = useState<PasswordError[]>([]);
  const [saving, setSaving] = useState(false);
  const [forAgency, setForAgency] = useState(defaultAgentId === AGENCY_CHOICE);
  const carrierOptions = [...carriers]
    .filter((carrier) => forAgency || carrier.agentAccessible || carrier.id === editing?.carrierId)
    .sort(byName);
  // A preset carrier (Add from a filtered list) that isn't open starts the select empty.
  const presetCarrierId = editing ? editing.carrierId : editor.mode === "add" ? (editor.carrierId ?? "") : "";
  const defaultCarrierId = carrierOptions.some((carrier) => carrier.id === presetCarrierId) ? presetCarrierId : "";

  const messageFor = (field: PasswordError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (...fields: PasswordError["field"][]) =>
    setErrors((current) => current.filter((error) => !fields.includes(error.field)));

  const agentError = messageFor("agentId");
  const carrierError = messageFor("carrierId");
  const usernameError = messageFor("username");
  const passwordError = messageFor("portalPassword");
  const linkError = messageFor("link");
  const formError = messageFor("form") ?? messageFor("status");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const text = (field: PasswordField) => String(data.get(field) ?? "").trim();
    const status = text("status");
    const agentChoice = text("agentId");
    const values: PasswordValues = {
      agentId: agentChoice === AGENCY_CHOICE ? null : agentChoice,
      agencyId: agentChoice === AGENCY_CHOICE && agency ? agency.id : null,
      carrierId: text("carrierId"),
      username: text("username"),
      // Not trimmed or lowercased: spaces and case can matter in a password.
      portalPassword: String(data.get("portalPassword") ?? ""),
      link: text("link"),
      status: status === "pending" || status === "inactive" ? status : "active",
    };
    // Required, and spaces alone don't count. A valid password is still saved as typed.
    if (values.portalPassword.trim() === "") {
      setErrors([{ field: "portalPassword", message: "Password can't be blank." }]);
      return;
    }
    setSaving(true);
    try {
      const saveErrors = await onSave(values, editing);
      if (saveErrors.length > 0) {
        setErrors(saveErrors);
        return;
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing ? `Edit ${editing.agentName} at ${editing.carrierName}` : "Add password"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {editing
          ? "Saving records a note of what changed; the password itself is never written to a note."
          : "The password is added for everyone, with a note of what was entered (not the password)."}
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
            defaultValue={defaultAgentId}
            aria-invalid={agentError ? true : undefined}
            aria-describedby={agentError ? `${id}-agent-error` : undefined}
            onChange={(event) => {
              setForAgency(event.target.value === AGENCY_CHOICE);
              clear("agentId", "carrierId");
            }}
            className={INPUT_CLASS}
          >
            <option value="">Choose an agent</option>
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
            defaultValue={defaultCarrierId}
            aria-invalid={carrierError ? true : undefined}
            aria-describedby={carrierError ? `${id}-carrier-error` : undefined}
            onChange={() => clear("carrierId")}
            className={INPUT_CLASS}
          >
            <option value="">Choose a carrier</option>
            {carrierOptions.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
                {carrier.status === "inactive" ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Portal username"
          htmlFor={`${id}-username`}
          hint={usernameError ?? "Portal username for this agent at this carrier."}
          hintId={`${id}-username-hint`}
          error={usernameError !== null}
        >
          <input
            id={`${id}-username`}
            name="username"
            type="text"
            required
            pattern=".*\S.*"
            autoComplete="off"
            aria-invalid={usernameError ? true : undefined}
            aria-describedby={`${id}-username-hint`}
            defaultValue={editing?.username}
            onChange={() => clear("username")}
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
            onChange={() => clear("portalPassword")}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Link"
          htmlFor={`${id}-link`}
          hint={linkError ?? undefined}
          hintId={`${id}-link-error`}
          error
        >
          <input
            id={`${id}-link`}
            name="link"
            type="url"
            autoComplete="off"
            defaultValue={editing?.link}
            aria-invalid={linkError ? true : undefined}
            aria-describedby={linkError ? `${id}-link-error` : undefined}
            onChange={() => clear("link")}
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
  );
}
