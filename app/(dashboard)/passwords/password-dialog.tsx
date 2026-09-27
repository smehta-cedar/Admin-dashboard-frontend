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
 * The one Add / Edit password dialog: agent, carrier, portal username and
 * password, status. Writing numbers live on carrier contracts. The
 * Passwords page opens it from Add password (the carrier pre-picked from
 * its filter) and a row's Edit.
 *
 * The view passes `onSave`, which calls the savePassword server action
 * (./actions.ts) and updates its own state from the saved record. The API
 * keeps one password per agent at each carrier and records the change note;
 * the form only checks what it can see at once (a blank password). While
 * the save is in flight the buttons are disabled.
 */

/** Which dialog is open. Add may start on a carrier; edit holds the record as it was. */
export type PasswordEditor =
  | { mode: "add"; carrierId?: string }
  | { mode: "edit"; password: PasswordRecord };

export type { PasswordError, PasswordValues } from "@/lib/passwords";

export type AgentOption = Pick<AgentRecord, "id" | "name" | "status">;
export type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status">;

/** Also the order changes are listed in on a note. */
export const PASSWORD_FIELD_LABELS: Record<PasswordField, string> = {
  agentId: "Agent",
  carrierId: "Carrier",
  username: "Portal username",
  portalPassword: "Password",
  status: "Status",
};

type PasswordDialogProps = {
  /** Null keeps the dialog closed. */
  editor: PasswordEditor | null;
  agents: AgentOption[];
  carriers: CarrierOption[];
  /** Saves the values; resolves with the errors to show instead of closing. */
  onSave: (values: PasswordValues, editing?: PasswordRecord) => Promise<PasswordError[]>;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function PasswordDialog({
  editor,
  agents,
  carriers,
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
  onSave,
  close,
}: PasswordFormProps) {
  const editing = editor.mode === "edit" ? editor.password : undefined;
  const [errors, setErrors] = useState<PasswordError[]>([]);
  const [saving, setSaving] = useState(false);

  const messageFor = (field: PasswordError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (...fields: PasswordError["field"][]) =>
    setErrors((current) => current.filter((error) => !fields.includes(error.field)));

  const agentError = messageFor("agentId");
  const carrierError = messageFor("carrierId");
  const usernameError = messageFor("username");
  const passwordError = messageFor("portalPassword");
  const formError = messageFor("form") ?? messageFor("status");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const text = (field: PasswordField) => String(data.get(field) ?? "").trim();
    const status = text("status");
    const values: PasswordValues = {
      agentId: text("agentId"),
      carrierId: text("carrierId"),
      username: text("username"),
      // Not trimmed or lowercased: spaces and case can matter in a password.
      portalPassword: String(data.get("portalPassword") ?? ""),
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
            defaultValue={editing?.agentId ?? ""}
            aria-invalid={agentError ? true : undefined}
            aria-describedby={agentError ? `${id}-agent-error` : undefined}
            onChange={() => clear("agentId", "carrierId")}
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
            defaultValue={
              editor.mode === "edit" ? editor.password.carrierId : (editor.carrierId ?? "")
            }
            aria-invalid={carrierError ? true : undefined}
            aria-describedby={carrierError ? `${id}-carrier-error` : undefined}
            onChange={() => clear("carrierId")}
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
