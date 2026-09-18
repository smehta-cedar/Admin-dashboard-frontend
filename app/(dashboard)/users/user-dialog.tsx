"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { PasswordInput } from "@/components/credential-value";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { diffValues, nextId } from "@/lib/change-notes";
import type { UserField, UserNote, UserRecord, UserRole } from "@/lib/users";

/*
 * The one Add / Edit user dialog: name, email, role (admin or staff), status
 * and password. The Users page opens it from Add user and a row's Edit; there
 * is no user profile page yet. Agent and agency sign-in is a later phase, so
 * there is no agent role here and no link from a user to an agent.
 *
 * Each view owns its users and notes state and passes `onSave`, which usually
 * calls `saveUser` below and sets that state. Adds and edits are dummy:
 * nothing reaches a server, and a refresh brings back the JSON.
 */

/** Which dialog is open. Edit holds the user as it was when the dialog opened. */
export type UserEditor = { mode: "add" } | { mode: "edit"; user: UserRecord };

export type UserValues = Omit<UserRecord, "id">;

/** A save error, shown under the field it names. */
export type UserError = { field: "email" | "password"; message: string };

/** Also the order changes are compared and listed in. */
export const USER_FIELD_LABELS: Record<UserField, string> = {
  name: "Name",
  email: "Email",
  role: "Role",
  status: "Status",
  password: "Password",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  staff: "Staff",
};

const FIELDS = Object.keys(USER_FIELD_LABELS) as UserField[];

/** Recorded in notes only as "Password set" / "Password changed", never with its value. */
const REDACTED_FIELDS: UserField[] = ["password"];

type SaveInput = {
  /** Every user the email must be unique among. Only `id`, `name` and `email` are read from the others. */
  users: Pick<UserRecord, "id" | "name" | "email">[];
  /** Every user note, so the new note's ID is unique. */
  notes: UserNote[];
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
 * user already has (ignoring case), or a blank password. The view puts the
 * user into its own list.
 */
export function saveUser({ users, notes, values, editing }: SaveInput): SaveResult {
  const emailKey = values.email.toLowerCase();
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

  // Required, and spaces alone don't count. A valid password is still saved as typed.
  if (values.password.trim() === "") {
    return { error: { field: "password", message: "Password can't be blank." }, user: null };
  }

  const userId = editing?.id ?? nextId(users);
  const saved = { id: userId, ...values };
  const changes = diffValues(FIELDS, editing ?? {}, values, REDACTED_FIELDS);
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
  /** Saves the values; returns the error to show instead of closing. */
  onSave: (values: UserValues) => UserError | null;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function UserDialog({ editor, onSave, onClose }: UserDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? <UserForm id={id} editor={editor} onSave={onSave} close={close} /> : null}
    </ModalDialog>
  );
}

type UserFormProps = Pick<UserDialogProps, "onSave"> & {
  id: string;
  editor: UserEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function UserForm({ id, editor, onSave, close }: UserFormProps) {
  const editing = editor.mode === "edit" ? editor.user : undefined;
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (field: UserField) => String(data.get(field) ?? "").trim();
    const error = onSave({
      name: text("name"),
      email: text("email"),
      role: text("role") === "admin" ? "admin" : "staff",
      status: text("status") === "inactive" ? "inactive" : "active",
      // Not trimmed or lowercased: spaces and case can matter in a password.
      password: String(data.get("password") ?? ""),
    });
    if (error) {
      if (error.field === "email") setEmailError(error.message);
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
            defaultValue={editing?.role ?? "staff"}
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
