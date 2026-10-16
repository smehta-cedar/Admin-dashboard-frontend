"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { PasswordInput } from "@/components/credential-value";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import type { RoleOption, UserError, UserField, UserRecord, UserValues } from "@/lib/users";

/*
 * The one Add / Edit user dialog: name, email, phone, roles, status and
 * password. The Users page opens it from Add user and a row's Edit; there is
 * no user profile page. Users are staff accounts, not agents or the agency.
 *
 * A user can hold any number of roles, ticked as checkboxes. Only a
 * superuser can change them; anyone else sees them read-only.
 *
 * The view passes `onSave`, which calls the saveUser server action
 * (./actions.ts) and updates its own state from the saved record. The
 * password is required on add and optional on edit: left blank, it stays as
 * it is. While the save is in flight the buttons are disabled.
 */

/** Which dialog is open. Edit holds the user as it was when the dialog opened. */
export type UserEditor = { mode: "add" } | { mode: "edit"; user: UserRecord };

export type { UserError, UserValues } from "@/lib/users";

/** Also the order changes are listed in on a note. */
export const USER_FIELD_LABELS: Record<UserField, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  roles: "Roles",
  role: "Role",
  status: "Status",
  password: "Password",
};

type UserDialogProps = {
  /** Null keeps the dialog closed. */
  editor: UserEditor | null;
  /** The roles a user can be given, by name. */
  roles: RoleOption[];
  /** Only a superuser can change anyone's roles. */
  canAssignRoles: boolean;
  /** Saves the values; resolves with the error to show instead of closing. */
  onSave: (values: UserValues) => Promise<UserError | null>;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function UserDialog({ editor, roles, canAssignRoles, onSave, onClose }: UserDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? <UserForm id={id} editor={editor} roles={roles} canAssignRoles={canAssignRoles} onSave={onSave} close={close} /> : null}
    </ModalDialog>
  );
}

type UserFormProps = Pick<UserDialogProps, "onSave" | "roles" | "canAssignRoles"> & {
  id: string;
  editor: UserEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function UserForm({ id, editor, roles, canAssignRoles, onSave, close }: UserFormProps) {
  const editing = editor.mode === "edit" ? editor.user : undefined;
  const currentRoleIds = editing?.roles.map((role) => role.id) ?? [];
  // Only active roles are offered; unticking the form drops an inactive one, which grants nothing anyway.
  const [roleIds, setRoleIds] = useState(() => currentRoleIds.filter((roleId) => roles.some((role) => role.id === roleId)));
  const [error, setError] = useState<UserError | null>(null);
  const [saving, setSaving] = useState(false);

  const messageFor = (field: UserError["field"]) => (error?.field === field ? error.message : null);
  const clear = () => setError(null);

  const nameError = messageFor("name");
  const emailError = messageFor("email");
  const phoneError = messageFor("phone");
  const roleError = messageFor("roleIds");
  const passwordError = messageFor("password");
  const formError = messageFor("form") ?? messageFor("status");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const text = (field: string) => String(data.get(field) ?? "").trim();
    const values: UserValues = {
      name: text("name"),
      email: text("email"),
      phone: text("phone"),
      // Left as they are for anyone who can't change them.
      roleIds: canAssignRoles ? roleIds : currentRoleIds,
      status: text("status") === "inactive" ? "inactive" : "active",
      // Not trimmed or lowercased: spaces and case can matter in a password.
      password: String(data.get("password") ?? ""),
    };
    // Required on add, and spaces alone don't count; on edit, blank keeps the current one.
    if (values.password.trim() === "" && (!editing || values.password !== "")) {
      setError({ field: "password", message: "Password can't be blank." });
      return;
    }
    setSaving(true);
    try {
      const saveError = await onSave(values);
      if (saveError) {
        setError(saveError);
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
        {editing ? `Edit ${editing.name}` : "Add user"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {editing
          ? "Saving records a note of what changed; a new password is noted only as changed."
          : "The account is created for everyone, with a note of what was entered (not the password)."}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          htmlFor={`${id}-name`}
          hint={nameError ?? undefined}
          hintId={`${id}-name-error`}
          error
        >
          <input
            id={`${id}-name`}
            name="name"
            type="text"
            required
            pattern=".*\S.*"
            autoComplete="off"
            defaultValue={editing?.name}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${id}-name-error` : undefined}
            onChange={clear}
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
            onChange={clear}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Phone"
          optional
          htmlFor={`${id}-phone`}
          hint={phoneError ?? undefined}
          hintId={`${id}-phone-error`}
          error
        >
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            autoComplete="off"
            defaultValue={editing?.phone}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={phoneError ? `${id}-phone-error` : undefined}
            onChange={clear}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Status" htmlFor={`${id}-status`} hint="Inactive users are signed out and can't sign in." hintId={`${id}-status-hint`}>
          <select
            id={`${id}-status`}
            name="status"
            defaultValue={editing?.status ?? "active"}
            aria-describedby={`${id}-status-hint`}
            onChange={clear}
            className={INPUT_CLASS}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field
          label={editing ? "New password" : "Password"}
          optional={Boolean(editing)}
          htmlFor={`${id}-password`}
          hint={passwordError ?? (editing ? "Leave blank to keep the current password. Setting one signs them out everywhere." : undefined)}
          hintId={passwordError ? `${id}-password-error` : `${id}-password-hint`}
          error={passwordError !== null}
        >
          {/* Spaces are kept; all-spaces is rejected on submit. new-password stops the
              browser filling in the signed-in user's own saved password. */}
          <PasswordInput
            id={`${id}-password`}
            name="password"
            required={!editing}
            autoComplete="new-password"
            spellCheck={false}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? `${id}-password-error` : editing ? `${id}-password-hint` : undefined}
            onChange={clear}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <fieldset className="mt-4" aria-describedby={roleError ? `${id}-roles-error` : undefined}>
        <legend className="text-sm font-medium text-fg">Roles</legend>
        {canAssignRoles ? (
          roles.length === 0 ? (
            <p className="mt-2 text-sm text-fg-subtle">No active roles.</p>
          ) : (
            <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={roleIds.includes(role.id)}
                    onChange={(event) => {
                      const { checked } = event.target;
                      setRoleIds((current) =>
                        checked ? [...current, role.id] : current.filter((roleId) => roleId !== role.id),
                      );
                      clear();
                    }}
                    aria-invalid={roleError ? true : undefined}
                    className="size-4 accent-brand-strong"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          )
        ) : (
          <p className="mt-2 text-sm text-fg-muted">
            {editing?.roles.map((role) => role.name).join(", ") || "No roles"}
          </p>
        )}
        {roleError ? (
          <p id={`${id}-roles-error`} className="mt-1 text-xs text-danger">
            {roleError}
          </p>
        ) : null}
      </fieldset>

      {/* Errors about the attempt itself (the API's rules, no permission, API down), not one field. */}
      <div role="alert" className="mt-4">
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={close} disabled={saving} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add user"}
        </button>
      </div>
    </form>
  );
}
