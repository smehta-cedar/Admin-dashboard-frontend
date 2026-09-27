"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import type {
  ModuleOption,
  PermissionAction,
  PermissionFlags,
  RoleError,
  RolePermissions,
  RoleRecord,
  RoleValues,
} from "@/lib/roles";

/*
 * The one Add / Edit role dialog: name, status, description and a grid of
 * modules by action. Checking create, update or delete also checks view;
 * unchecking view clears the row. A header checkbox sets a whole column.
 *
 * The view passes `onSave` and `onDelete`, which call the server actions
 * (./actions.ts) and update its own state. Delete asks once more inside the
 * dialog before it runs; the API refuses it while any user holds the role.
 * While a save or delete is in flight the buttons are disabled.
 */

/** Which dialog is open. Edit holds the role as it was when the dialog opened. */
export type RoleEditor = { mode: "add" } | { mode: "edit"; role: RoleRecord };

export type { RoleError, RoleValues } from "@/lib/roles";

/** Column order in the grid; also the order the API stores them in. */
export const PERMISSION_ACTIONS: PermissionAction[] = ["view", "create", "update", "delete"];

const NO_ACCESS: PermissionFlags = { view: false, create: false, update: false, delete: false };

type RoleDialogProps = {
  /** Null keeps the dialog closed. */
  editor: RoleEditor | null;
  /** Every module a role can be granted, in menu order. */
  modules: ModuleOption[];
  /** Saves the values; resolves with the error to show instead of closing. */
  onSave: (values: RoleValues) => Promise<RoleError | null>;
  /** Deletes the role being edited; resolves with the error to show instead of closing. */
  onDelete: (role: RoleRecord) => Promise<RoleError | null>;
  /** Runs for every close: Cancel, Escape, backdrop click, a save or a delete. */
  onClose: () => void;
};

export function RoleDialog({ editor, modules, onSave, onDelete, onClose }: RoleDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? (
        <RoleForm id={id} editor={editor} modules={modules} onSave={onSave} onDelete={onDelete} close={close} />
      ) : null}
    </ModalDialog>
  );
}

type RoleFormProps = Pick<RoleDialogProps, "onSave" | "onDelete" | "modules"> & {
  id: string;
  editor: RoleEditor;
  close: () => void;
};

/** Every module with the flags the role holds, or none. */
function initialPermissions(modules: ModuleOption[], role?: RoleRecord): RolePermissions {
  const permissions: RolePermissions = {};
  for (const module of modules) permissions[module.code] = { ...(role?.permissions[module.code] ?? NO_ACCESS) };
  return permissions;
}

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function RoleForm({ id, editor, modules, onSave, onDelete, close }: RoleFormProps) {
  const editing = editor.mode === "edit" ? editor.role : undefined;
  const [permissions, setPermissions] = useState(() => initialPermissions(modules, editing));
  const [error, setError] = useState<RoleError | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const messageFor = (field: RoleError["field"]) => (error?.field === field ? error.message : null);
  const clear = () => setError(null);

  const nameError = messageFor("name");
  const descriptionError = messageFor("description");
  const permissionsError = messageFor("permissions");
  const formError = messageFor("form") ?? messageFor("status");

  /** Sets one flag, keeping the rule that create, update and delete need view. */
  const setFlag = (module: string, action: PermissionAction, checked: boolean) => {
    clear();
    setPermissions((current) => {
      const flags = { ...current[module] };
      if (action === "view" && !checked) {
        return { ...current, [module]: { ...NO_ACCESS } };
      }
      flags[action] = checked;
      if (checked) flags.view = true;
      return { ...current, [module]: flags };
    });
  };

  /** Sets one action for every module, with the same view rule. */
  const setColumn = (action: PermissionAction, checked: boolean) => {
    clear();
    setPermissions((current) => {
      const next: RolePermissions = {};
      for (const module of modules) {
        const flags = { ...current[module.code] };
        if (action === "view" && !checked) {
          next[module.code] = { ...NO_ACCESS };
          continue;
        }
        flags[action] = checked;
        if (checked) flags.view = true;
        next[module.code] = flags;
      }
      return next;
    });
  };

  const columnChecked = (action: PermissionAction) =>
    modules.length > 0 && modules.every((module) => permissions[module.code]?.[action]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const text = (field: string) => String(data.get(field) ?? "").trim();
    const values: RoleValues = {
      name: text("name"),
      description: text("description"),
      status: text("status") === "inactive" ? "inactive" : "active",
      permissions,
    };
    setBusy(true);
    try {
      const saveError = await onSave(values);
      if (saveError) {
        setError(saveError);
        return;
      }
      close();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || busy) return;
    setBusy(true);
    try {
      const deleteError = await onDelete(editing);
      if (deleteError) {
        setConfirmingDelete(false);
        setError(deleteError);
        return;
      }
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing ? `Edit ${editing.name}` : "Add role"}
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${id}-name`} hint={nameError ?? undefined} hintId={`${id}-name-error`} error>
          <input
            id={`${id}-name`}
            name="name"
            type="text"
            required
            pattern=".*\S.*"
            maxLength={100}
            autoComplete="off"
            defaultValue={editing?.name}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${id}-name-error` : undefined}
            onChange={clear}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Status" htmlFor={`${id}-status`}>
          <select
            id={`${id}-status`}
            name="status"
            defaultValue={editing?.status ?? "active"}
            onChange={clear}
            className={INPUT_CLASS}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field
          label="Description"
          optional
          htmlFor={`${id}-description`}
          hint={descriptionError ?? undefined}
          hintId={`${id}-description-error`}
          error
          className="sm:col-span-2"
        >
          <textarea
            id={`${id}-description`}
            name="description"
            rows={2}
            autoComplete="off"
            defaultValue={editing?.description}
            aria-invalid={descriptionError ? true : undefined}
            aria-describedby={descriptionError ? `${id}-description-error` : undefined}
            onChange={clear}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-fg">Permissions</legend>
        <div className="mt-2 overflow-x-auto rounded-md border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-xs text-fg-subtle">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Module
                </th>
                {PERMISSION_ACTIONS.map((action) => (
                  <th key={action} scope="col" className="w-24 px-2 py-2 text-center font-medium capitalize">
                    <label className="inline-flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={columnChecked(action)}
                        onChange={(event) => setColumn(action, event.currentTarget.checked)}
                        className="size-4 rounded border-line-strong accent-brand-strong"
                      />
                      {action}
                      <span className="sr-only"> for every module</span>
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr key={module.code} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-left font-normal text-fg">
                    {module.label}
                  </th>
                  {PERMISSION_ACTIONS.map((action) => (
                    <td key={action} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${action} ${module.label}`}
                        checked={permissions[module.code]?.[action] ?? false}
                        onChange={(event) => setFlag(module.code, action, event.currentTarget.checked)}
                        className="size-4 rounded border-line-strong accent-brand-strong"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {permissionsError ? <p className="mt-1 text-xs text-danger">{permissionsError}</p> : null}
      </fieldset>

      {/* Errors about the attempt itself (not a superuser, users still hold the role, API down), not one field. */}
      <div role="alert" className="mt-4">
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          {editing ? (
            confirmingDelete ? (
              <span className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                Delete {editing.name}?
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="rounded-md bg-danger-strong px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                  className={GHOST_BUTTON_CLASS}
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className={`${GHOST_BUTTON_CLASS} text-danger hover:text-danger`}
              >
                Delete role
              </button>
            )
          ) : null}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={close} disabled={busy} className={GHOST_BUTTON_CLASS}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
            {busy && !confirmingDelete ? "Saving…" : editing ? "Save changes" : "Add role"}
          </button>
        </div>
      </div>
    </form>
  );
}
