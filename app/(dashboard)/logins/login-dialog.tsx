"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { PasswordInput } from "@/components/credential-value";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import type { AgentRecord } from "@/lib/agents";
import type { CarrierRecord } from "@/lib/carriers";
import { diffValues, nextId } from "@/lib/change-notes";
import type { LoginField, LoginNote, LoginRecord } from "@/lib/logins";
import { byName } from "@/lib/text";

/*
 * The one Add / Edit login dialog: agent, carrier, writing number, portal
 * username and password, status. The Logins page opens it from Add login (the
 * carrier pre-picked from its filter) and a row's Edit.
 *
 * The view owns its logins and notes state and passes `onSave`, which calls
 * `saveLogin` below and sets that state. Adds and edits are dummy: nothing
 * reaches a server, and a refresh brings back the JSON.
 */

/** Which dialog is open. Add may start on a carrier; edit holds the login as it was. */
export type LoginEditor = { mode: "add"; carrierId?: string } | { mode: "edit"; login: LoginRecord };

export type LoginValues = Omit<LoginRecord, "id">;

/** A save error, shown under the field it names. Several can fail at once. */
export type LoginError = { field: "carrierId" | "writingNumber" | "portalPassword"; message: string };

export type AgentOption = Pick<AgentRecord, "id" | "name" | "status">;
export type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status">;

/** Also the order changes are compared and listed in. */
export const LOGIN_FIELD_LABELS: Record<LoginField, string> = {
  agentId: "Agent",
  carrierId: "Carrier",
  writingNumber: "Writing number",
  username: "Portal username",
  portalPassword: "Password",
  status: "Status",
};

const FIELDS = Object.keys(LOGIN_FIELD_LABELS) as LoginField[];

const EMPTY_VALUES = { agentId: "", carrierId: "", writingNumber: "", username: "", portalPassword: "" };

/** Recorded in notes only as "Password changed", never with its value. */
const REDACTED_FIELDS: LoginField[] = ["portalPassword"];

type SaveInput = {
  logins: LoginRecord[];
  /** Every login note, so the new note's ID is unique. */
  notes: LoginNote[];
  values: LoginValues;
  /** The login being edited; leave out when adding. */
  editing?: LoginRecord;
  agentName: (agentId: string) => string;
  carrierName: (carrierId: string) => string;
};

type SaveResult =
  | { errors: LoginError[]; login: null }
  | {
      errors: [];
      /** The login as saved; on an edit that changed nothing, the record as it was. */
      login: LoginRecord;
      /** False when an edit changed nothing: no new logins or note. */
      changed: boolean;
      logins: LoginRecord[];
      notes: LoginNote[];
    };

/**
 * Adds or edits a login, pure. Returns the next logins and notes (a note only
 * when something changed), or every error to show: a second login for the
 * same agent at the same carrier, a writing number already used at that
 * carrier (ignoring case), and a blank password.
 */
export function saveLogin({ logins, notes, values, editing, agentName, carrierName }: SaveInput): SaveResult {
  const others = logins.filter((login) => login.id !== editing?.id);
  const pairOwner = others.find(
    (login) => login.agentId === values.agentId && login.carrierId === values.carrierId,
  );
  const numberKey = values.writingNumber.toLowerCase();
  const numberOwner = others.find(
    (login) => login.carrierId === values.carrierId && login.writingNumber.toLowerCase() === numberKey,
  );

  // Messages name agents and carriers, never IDs.
  const errors: LoginError[] = [];
  if (pairOwner) {
    errors.push({
      field: "carrierId",
      message: `${agentName(values.agentId)} already has a login at ${carrierName(values.carrierId)}.`,
    });
  }
  // Skip when it's the same login the carrier error already names. The number
  // is shown as stored, which may differ in case from what was typed.
  if (numberOwner && numberOwner !== pairOwner) {
    errors.push({
      field: "writingNumber",
      message: `Writing number ${numberOwner.writingNumber} is already used at ${carrierName(values.carrierId)} by ${agentName(numberOwner.agentId)}.`,
    });
  }
  // Required, and spaces alone don't count. A valid password is still saved as typed.
  if (values.portalPassword.trim() === "") {
    errors.push({ field: "portalPassword", message: "Password can't be blank." });
  }
  if (errors.length > 0) return { errors, login: null };

  /** Values as notes show them: agent and carrier by name. */
  const shown = (from: LoginValues) => ({
    ...from,
    agentId: agentName(from.agentId),
    carrierId: carrierName(from.carrierId),
  });
  const loginId = editing?.id ?? nextId(logins);
  const saved = { id: loginId, ...values };
  const changes = diffValues(FIELDS, editing ? shown(editing) : EMPTY_VALUES, shown(values), REDACTED_FIELDS);
  // Saving an edit with nothing changed just closes, without a note.
  if (changes.length === 0) return { errors: [], login: saved, changed: false, logins, notes };

  return {
    errors: [],
    login: saved,
    changed: true,
    logins: editing
      ? logins.map((login) => (login.id === loginId ? saved : login))
      : [...logins, saved],
    notes: [
      {
        id: nextId(notes),
        loginId,
        kind: editing ? "edited" : "added",
        createdAt: new Date().toISOString(),
        changes,
      },
      ...notes,
    ],
  };
}

type LoginDialogProps = {
  /** Null keeps the dialog closed. */
  editor: LoginEditor | null;
  agents: AgentOption[];
  carriers: CarrierOption[];
  /** Saves the values; returns the errors to show instead of closing. */
  onSave: (values: LoginValues, editing?: LoginRecord) => LoginError[];
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function LoginDialog({ editor, agents, carriers, onSave, onClose }: LoginDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? (
        <LoginForm
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

type LoginFormProps = Omit<LoginDialogProps, "editor" | "onClose"> & {
  id: string;
  editor: LoginEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function LoginForm({ id, editor, agents, carriers, onSave, close }: LoginFormProps) {
  const editing = editor.mode === "edit" ? editor.login : undefined;
  const [errors, setErrors] = useState<LoginError[]>([]);

  const messageFor = (field: LoginError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (...fields: LoginError["field"][]) =>
    setErrors((current) => current.filter((error) => !fields.includes(error.field)));

  const agentName = (agentId: string) =>
    agents.find((agent) => agent.id === agentId)?.name ?? `Agent ${agentId}`;
  const carrierName = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.name ?? `Carrier ${carrierId}`;

  const carrierError = messageFor("carrierId");
  const writingNumberError = messageFor("writingNumber");
  const passwordError = messageFor("portalPassword");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (field: LoginField) => String(data.get(field) ?? "").trim();
    const status = text("status");
    const saveErrors = onSave(
      {
        agentId: text("agentId"),
        carrierId: text("carrierId"),
        writingNumber: text("writingNumber"),
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
          : "Add login"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
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
            defaultValue={editor.mode === "edit" ? editor.login.carrierId : (editor.carrierId ?? "")}
            aria-invalid={carrierError ? true : undefined}
            aria-describedby={carrierError ? `${id}-carrier-error` : undefined}
            onChange={() => clear("carrierId", "writingNumber")}
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
            onChange={() => clear("writingNumber")}
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
          {editing ? "Save changes" : "Add login"}
        </button>
      </div>
    </form>
  );
}
