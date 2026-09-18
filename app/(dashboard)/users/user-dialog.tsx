"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import type { AgentRecord } from "@/lib/agents";
import { diffValues, nextId } from "@/lib/change-notes";
import type { UserField, UserNote, UserRecord, UserRole } from "@/lib/users";
import { PasswordInput } from "../logins/credential-value";

/*
 * The one Add / Edit user dialog: name, email, role, the linked agent (only
 * when the role is agent), status and password. The Users page opens it from
 * Add user and a row's Edit; there is no user profile page yet.
 *
 * Each view owns its users and notes state and passes `onSave`, which usually
 * calls `saveUser` below and sets that state. Adds and edits are dummy:
 * nothing reaches a server, and a refresh brings back the JSON.
 */

/** Which dialog is open. Edit holds the user as it was when the dialog opened. */
export type UserEditor = { mode: "add" } | { mode: "edit"; user: UserRecord };

export type UserValues = Omit<UserRecord, "id">;

/** A save error, shown under the field it names. */
export type UserError = { field: "email" | "agentId" | "password"; message: string };

/** The agents a user can be linked to; the form only reads these three fields. */
export type AgentOption = Pick<AgentRecord, "id" | "name" | "status">;

/** Also the order changes are compared and listed in. */
export const USER_FIELD_LABELS: Record<UserField, string> = {
  name: "Name",
  email: "Email",
  role: "Role",
  agentId: "Linked agent",
  status: "Status",
  password: "Password",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  staff: "Staff",
  agent: "Agent",
};

const FIELDS = Object.keys(USER_FIELD_LABELS) as UserField[];

/** Recorded in notes only as "Password set" / "Password changed", never with its value. */
const REDACTED_FIELDS: UserField[] = ["password"];

/** A user's values as notes compare and show them: the linked agent by name, not ID. */
const noteValues = (values: UserValues, agents: AgentOption[]) => ({
  ...values,
  agentId: values.agentId
    ? (agents.find((agent) => agent.id === values.agentId)?.name ?? `Agent ${values.agentId}`)
    : "",
});

type SaveInput = {
  /** Every user the email must be unique among. Only `id`, `name` and `email` are read from the others. */
  users: Pick<UserRecord, "id" | "name" | "email">[];
  /** Every user note, so the new note's ID is unique. */
  notes: UserNote[];
  /** The agents a linked agent must be one of. */
  agents: AgentOption[];
  values: UserValues;
  /** The user being edited; leave out when adding. */
  editing?: UserRecord;
};

type SaveResult =
  | { error: UserError; user: null }
  | {
      error: null;
      /** The user as saved; on an edit that changed nothing, the record as it was. */
      user: UserRecord;
      /** False when an edit changed nothing: no new note. */
      changed: boolean;
      notes: UserNote[];
    };

/**
 * Adds or edits a user, pure. Returns the saved user and the next notes (a
 * note only when something changed), or the error to show: an email another
 * user already has (ignoring case), an agent role with no known agent, or a
 * blank password. A role other than agent drops any agentId. The view puts the
 * user into its own list.
 */
export function saveUser({ users, notes, agents, values: input, editing }: SaveInput): SaveResult {
  const emailKey = input.email.toLowerCase();
  const emailOwner = users.find(
    (user) => user.id !== editing?.id && user.email.toLowerCase() === emailKey,
  );
  if (emailOwner) {
    return {
      error: {
        field: "email",
        message: `Email ${emailOwner.email} already belongs to ${emailOwner.name}.`,
      },
      user: null,
    };
  }

  // The select is required too; this holds for any caller.
  if (input.role === "agent" && !agents.some((agent) => agent.id === input.agentId)) {
    return {
      error: { field: "agentId", message: "Choose the agent this user signs in as." },
      user: null,
    };
  }

  // Required, and spaces alone don't count. A valid password is still saved as typed.
  if (input.password.trim() === "") {
    return { error: { field: "password", message: "Password can't be blank." }, user: null };
  }

  // Only an agent user links to an agent.
  const { agentId, ...rest } = input;
  const values: UserValues = input.role === "agent" ? { ...rest, agentId } : rest;

  const userId = editing?.id ?? nextId(users);
  const saved = { id: userId, ...values };
  const changes = diffValues(
    FIELDS,
    editing ? noteValues(editing, agents) : {},
    noteValues(values, agents),
    REDACTED_FIELDS,
  );
  // Saving an edit with nothing changed just closes, without a note.
  if (changes.length === 0) return { error: null, user: saved, changed: false, notes };

  return {
    error: null,
    user: saved,
    changed: true,
    notes: [
      {
        id: nextId(notes),
        userId,
        kind: editing ? "edited" : "added",
        createdAt: new Date().toISOString(),
        changes,
      },
      ...notes,
    ],
  };
}

type UserDialogProps = {
  /** Null keeps the dialog closed. */
  editor: UserEditor | null;
  agents: AgentOption[];
  /** Saves the values; returns the error to show instead of closing. */
  onSave: (values: UserValues) => UserError | null;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function UserDialog({ editor, agents, onSave, onClose }: UserDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? (
        <UserForm id={id} editor={editor} agents={agents} onSave={onSave} close={close} />
      ) : null}
    </ModalDialog>
  );
}

type UserFormProps = Pick<UserDialogProps, "agents" | "onSave"> & {
  id: string;
  editor: UserEditor;
  close: () => void;
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function UserForm({ id, editor, agents, onSave, close }: UserFormProps) {
  const editing = editor.mode === "edit" ? editor.user : undefined;
  const [emailError, setEmailError] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Follows the role select: the linked-agent select renders only for agents,
  // so moving away from agent clears the link on save.
  const [role, setRole] = useState<UserRole>(editing?.role ?? "staff");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (field: UserField) => String(data.get(field) ?? "").trim();
    const agentId = text("agentId");
    const error = onSave({
      name: text("name"),
      email: text("email"),
      role,
      status: text("status") === "inactive" ? "inactive" : "active",
      // Not trimmed or lowercased: spaces and case can matter in a password.
      password: String(data.get("password") ?? ""),
      ...(role === "agent" && agentId ? { agentId } : {}),
    });
    if (error) {
      if (error.field === "email") setEmailError(error.message);
      else if (error.field === "agentId") setAgentError(error.message);
      else setPasswordError(error.message);
      return;
    }
    close();
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing ? `Edit ${editing.name}` : "Add user"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {editing
          ? "Saving records a note of what changed. Nothing is saved anywhere yet; refreshing undoes it."
          : "Not saved anywhere yet. The user stays in the list until you refresh."}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${id}-name`}>
          <input
            id={`${id}-name`}
            name="name"
            type="text"
            required
            pattern=".*\S.*"
            autoComplete="off"
            defaultValue={editing?.name}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Email"
          htmlFor={`${id}-email`}
          hint={emailError ?? "What they sign in with."}
          hintId={emailError ? `${id}-email-error` : `${id}-email-hint`}
          error={emailError !== null}
        >
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            autoComplete="off"
            defaultValue={editing?.email}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? `${id}-email-error` : `${id}-email-hint`}
            onChange={() => setEmailError(null)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Role"
          htmlFor={`${id}-role`}
          hint="Shown only for now; every signed-in user still sees the whole app."
          hintId={`${id}-role-hint`}
        >
          <select
            id={`${id}-role`}
            name="role"
            value={role}
            onChange={(event) => {
              setRole(event.target.value as UserRole);
              setAgentError(null);
            }}
            aria-describedby={`${id}-role-hint`}
            className={INPUT_CLASS}
          >
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor={`${id}-status`}>
          <select
            id={`${id}-status`}
            name="status"
            defaultValue={editing?.status ?? "active"}
            className={INPUT_CLASS}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        {role === "agent" ? (
          <Field
            label="Linked agent"
            htmlFor={`${id}-agent`}
            hint={agentError ?? "The agent on the Agents page this user is."}
            hintId={agentError ? `${id}-agent-error` : `${id}-agent-hint`}
            error={agentError !== null}
            className="sm:col-span-2"
          >
            <select
              id={`${id}-agent`}
              name="agentId"
              required
              defaultValue={editing?.agentId ?? ""}
              aria-invalid={agentError ? true : undefined}
              aria-describedby={agentError ? `${id}-agent-error` : `${id}-agent-hint`}
              onChange={() => setAgentError(null)}
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
        ) : null}
        <Field
          label="Password"
          htmlFor={`${id}-password`}
          hint={passwordError ?? undefined}
          hintId={`${id}-password-error`}
          error
          className="sm:col-span-2"
        >
          {/* Spaces are kept; all-spaces is rejected on submit. new-password stops the
              browser filling in the signed-in user's own saved password. */}
          <PasswordInput
            id={`${id}-password`}
            name="password"
            required
            autoComplete="new-password"
            spellCheck={false}
            defaultValue={editing?.password}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? `${id}-password-error` : undefined}
            onChange={() => setPasswordError(null)}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={close} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" className={PRIMARY_BUTTON_CLASS}>
          {editing ? "Save changes" : "Add user"}
        </button>
      </div>
    </form>
  );
}
