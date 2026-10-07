"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import type {
  PolicyTypeError,
  PolicyTypeField,
  PolicyTypeRecord,
  PolicyTypeValues,
} from "@/lib/policy-types";

/*
 * The one Add / Edit policy type dialog: name and status. The Policy types page opens it from Add policy type and a row's Edit.
 *
 * The view passes `onSave`, which calls the savePolicyType server action
 * (./actions.ts) and updates its own state from the saved record. The API
 * checks the name against every other policy type and records the change
 * note; a duplicate name comes back as the API's message under the name.
 * While the save is in flight the buttons are disabled.
 */

/** Which dialog is open. Edit holds the policy type as it was when the dialog opened. */
export type PolicyTypeEditor = { mode: "add" } | { mode: "edit"; policyType: PolicyTypeRecord };

export type { PolicyTypeError, PolicyTypeValues } from "@/lib/policy-types";

/** Also the order changes are listed in on a note. */
export const POLICY_TYPE_FIELD_LABELS: Record<PolicyTypeField, string> = {
  name: "Name",
  status: "Status",
};

type PolicyTypeDialogProps = {
  /** Null keeps the dialog closed. */
  editor: PolicyTypeEditor | null;
  /** Saves the values; resolves with the errors to show instead of closing. */
  onSave: (values: PolicyTypeValues) => Promise<PolicyTypeError[]>;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function PolicyTypeDialog({ editor, onSave, onClose }: PolicyTypeDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? <PolicyTypeForm id={id} editor={editor} onSave={onSave} close={close} /> : null}
    </ModalDialog>
  );
}

type PolicyTypeFormProps = Omit<PolicyTypeDialogProps, "editor" | "onClose"> & {
  id: string;
  editor: PolicyTypeEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function PolicyTypeForm({ id, editor, onSave, close }: PolicyTypeFormProps) {
  const editing = editor.mode === "edit" ? editor.policyType : undefined;
  const [errors, setErrors] = useState<PolicyTypeError[]>([]);
  const [saving, setSaving] = useState(false);

  const messageFor = (field: PolicyTypeError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (field: PolicyTypeError["field"]) =>
    setErrors((current) => current.filter((error) => error.field !== field));

  const nameError = messageFor("name");
  const formError = messageFor("form") ?? messageFor("status");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const values: PolicyTypeValues = {
      name: String(data.get("name") ?? "").trim(),
      status: String(data.get("status")) === "inactive" ? "inactive" : "active",
    };
    setSaving(true);
    try {
      const saveErrors = await onSave(values);
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
    <form onSubmit={handleSubmit} className="px-6 py-4">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing ? `Edit ${editing.name}` : "Add policy type"}
      </h2>

      {/* Name, then status. */}
      <div className="mt-5 grid gap-4">
        <Field
          label="Name"
          htmlFor={`${id}-name`}
          required
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
            maxLength={255}
            autoComplete="off"
            defaultValue={editing?.name}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${id}-name-error` : undefined}
            onChange={() => clear("name")}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Status" htmlFor={`${id}-status`} className="sm:w-40">
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
          {saving ? "Saving…" : editing ? "Save changes" : "Add policy type"}
        </button>
      </div>
    </form>
  );
}
