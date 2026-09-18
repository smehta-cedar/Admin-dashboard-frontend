"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { PasswordInput } from "@/components/credential-value";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import type { AgentRecord } from "@/lib/agents";
import type { CarrierRecord } from "@/lib/carriers";
import { diffValues, nextId } from "@/lib/change-notes";
import type { PasswordField, PasswordNote, PasswordRecord } from "@/lib/passwords";
import { byName } from "@/lib/text";

/*
 * The one Add / Edit password dialog: agent, carrier, portal username and
 * password, status. Writing numbers live on carrier contracts. The Name
 * Passwords page opens it from Add password (the carrier pre-picked from
 * its filter) and a row's Edit.
 *
 * The view owns its passwords and notes state and passes `onSave`, which
 * calls `savePassword` below and sets that state. Adds and edits are
 * dummy: nothing reaches a server, and a refresh brings back the JSON.
 */

/** Which dialog is open. Add may start on a carrier; edit holds the record as it was. */
export type PasswordEditor =
  | { mode: "add"; carrierId?: string }
  | { mode: "edit"; password: PasswordRecord };

export type PasswordValues = Omit<PasswordRecord, "id">;

/** A save error, shown under the field it names. Several can fail at once. */
export type PasswordError = { field: "carrierId" | "portalPassword"; message: string };

export type AgentOption = Pick<AgentRecord, "id" | "name" | "status">;
export type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status">;

/** Also the order changes are compared and listed in. */
export const PASSWORD_FIELD_LABELS: Record<PasswordField, string> = {
  agentId: "Agent",
  carrierId: "Carrier",
  username: "Portal username",
  portalPassword: "Password",
  status: "Status",
};

const FIELDS = Object.keys(PASSWORD_FIELD_LABELS) as PasswordField[];

const EMPTY_VALUES = { agentId: "", carrierId: "", username: "", portalPassword: "" };

/** Recorded in notes only as "Password changed", never with its value. */
const REDACTED_FIELDS: PasswordField[] = ["portalPassword"];

type SaveInput = {
  passwords: PasswordRecord[];
  /** Every password note, so the new note's ID is unique. */
  notes: PasswordNote[];
  values: PasswordValues;
  /** The record being edited; leave out when adding. */
  editing?: PasswordRecord;
  agentName: (agentId: string) => string;
  carrierName: (carrierId: string) => string;
};

type SaveResult =
  | { errors: PasswordError[]; password: null }
  | {
      errors: [];
      /** The record as saved; on an edit that changed nothing, the record as it was. */
      password: PasswordRecord;
      /** False when an edit changed nothing: no new passwords or note. */
      changed: boolean;
      passwords: PasswordRecord[];
      notes: PasswordNote[];
    };

/**
 * Adds or edits a password, pure. Returns the next passwords and
 * notes (a note only when something changed), or every error to show: a second
 * password for the same agent at the same carrier, and a blank password.
 */
export function savePassword({
  passwords,
  notes,
  values,
  editing,
  agentName,
  carrierName,
}: SaveInput): SaveResult {
  const others = passwords.filter((record) => record.id !== editing?.id);
  const pairOwner = others.find(
    (record) => record.agentId === values.agentId && record.carrierId === values.carrierId,
  );

  // Messages name agents and carriers, never IDs.
  const errors: PasswordError[] = [];
  if (pairOwner) {
    errors.push({
      field: "carrierId",
      message: `${agentName(values.agentId)} already has a password at ${carrierName(values.carrierId)}.`,
    });
  }
  // Required, and spaces alone don't count. A valid password is still saved as typed.
  if (values.portalPassword.trim() === "") {
    errors.push({ field: "portalPassword", message: "Password can't be blank." });
  }
  if (errors.length > 0) return { errors, password: null };

  /** Values as notes show them: agent and carrier by name. */
  const shown = (from: PasswordValues) => ({
    ...from,
    agentId: agentName(from.agentId),
    carrierId: carrierName(from.carrierId),
  });
  const passwordId = editing?.id ?? nextId(passwords);
  const saved = { id: passwordId, ...values };
  const changes = diffValues(
    FIELDS,
    editing ? shown(editing) : EMPTY_VALUES,
    shown(values),
    REDACTED_FIELDS,
  );
  // Saving an edit with nothing changed just closes, without a note.
  if (changes.length === 0) {
    return { errors: [], password: saved, changed: false, passwords, notes };
  }

  return {
    errors: [],
    password: saved,
    changed: true,
    passwords: editing
      ? passwords.map((record) => (record.id === passwordId ? saved : record))
      : [...passwords, saved],
    notes: [
      {
        id: nextId(notes),
        passwordId,
        kind: editing ? "edited" : "added",
        createdAt: new Date().toISOString(),
        changes,
      },
      ...notes,
    ],
  };
}

type PasswordDialogProps = {
  /** Null keeps the dialog closed. */
  editor: PasswordEditor | null;
  agents: AgentOption[];
  carriers: CarrierOption[];
  /** Saves the values; returns the errors to show instead of closing. */
  onSave: (values: PasswordValues, editing?: PasswordRecord) => PasswordError[];
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

  const messageFor = (field: PasswordError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (...fields: PasswordError["field"][]) =>
    setErrors((current) => current.filter((error) => !fields.includes(error.field)));

  const agentName = (agentId: string) =>
    agents.find((agent) => agent.id === agentId)?.name ?? `Agent ${agentId}`;
  const carrierName = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.name ?? `Carrier ${carrierId}`;

  const carrierError = messageFor("carrierId");
  const passwordError = messageFor("portalPassword");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (field: PasswordField) => String(data.get(field) ?? "").trim();
    const status = text("status");
    const saveErrors = onSave(
      {
        agentId: text("agentId"),
        carrierId: text("carrierId"),
        username: text("username"),
        // Not trimmed or lowercased: spaces and case can matter in a password.
        portalPassword: String(data.get("portalPassword") ?? ""),
        status: status === "pending" || status === "inactive" ? status : "active",
      },
      editing,
    );
    if (saveErrors.length > 0) {
      setErrors(saveErrors);
      return;
    }
    close();
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing
          ? `Edit ${agentName(editing.agentId)} at ${carrierName(editing.carrierId)}`
          : "Add password"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {editing
          ? "Saving records a note of what changed. Nothing is saved anywhere yet; refreshing undoes it."
          : "Not saved anywhere yet. The password stays in the list until you refresh."}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Agent" htmlFor={`${id}-agent`}>
          <select
            id={`${id}-agent`}
            name="agentId"
            required
            defaultValue={editing?.agentId ?? ""}
            onChange={() => clear("carrierId")}
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
          hint="Portal username for this agent at this carrier."
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

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={close} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" className={PRIMARY_BUTTON_CLASS}>
          {editing ? "Save changes" : "Add password"}
        </button>
      </div>
    </form>
  );
}
