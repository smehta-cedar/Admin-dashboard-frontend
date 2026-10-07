"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { StateCheckboxes } from "@/components/state-checkboxes";
import type {
  CarrierPolicyError,
  CarrierPolicyField,
  CarrierPolicyRecord,
  CarrierPolicyValues,
} from "@/lib/carrier-policies";
import type { PolicyTypeRecord } from "@/lib/policy-types";

/*
 * The one Add / Edit dialog for a carrier's policy: name, an optional policy
 * type (from the active catalog; None is fine), status and the states it can be sold in, offered only
 * from the carrier's own available states. The carrier profile opens it from
 * the Policies panel's Add policy and a row's Edit; the carrier itself is
 * fixed by the profile and never shown as a field.
 *
 * The profile passes `onSave`, which calls the saveCarrierPolicy server
 * action (../policy-actions.ts) and updates its own state from the saved
 * record. The API checks the name against the carrier's other policies and
 * every state against the carrier's footprint, and records the change note;
 * a duplicate name comes back as the API's message under the name, a state
 * outside the footprint under the states. While the save is in flight the
 * buttons are disabled.
 */

/** Which dialog is open. Edit holds the policy as it was when the dialog opened. */
export type CarrierPolicyEditor = { mode: "add" } | { mode: "edit"; policy: CarrierPolicyRecord };

export type { CarrierPolicyError, CarrierPolicyValues } from "@/lib/carrier-policies";

/** Also the order changes are listed in on a note. */
export const CARRIER_POLICY_FIELD_LABELS: Record<CarrierPolicyField, string> = {
  name: "Name",
  policyType: "Policy type",
  carrier: "Carrier",
  availableStates: "Available states",
  status: "Status",
};

/** The form's values, read off the submitted FormData. */
export function readCarrierPolicyForm(data: FormData): CarrierPolicyValues {
  const text = (field: string) => String(data.get(field) ?? "").trim();
  return {
    name: text("name"),
    policyTypeId: text("policyType"),
    status: text("status") === "inactive" ? "inactive" : "active",
    availableStates: [
      ...new Set(data.getAll("availableStates").map((code) => String(code).trim()).filter(Boolean)),
    ].sort(),
  };
}

type CarrierPolicyDialogProps = {
  /** Null keeps the dialog closed. */
  editor: CarrierPolicyEditor | null;
  /** Names the dialog: "Add policy" is for this carrier. */
  carrierName: string;
  /** The carrier's available states: the only ones a policy can be sold in. */
  carrierStates: string[];
  /** Every policy type; the select offers the active ones (plus the one being edited). */
  policyTypes: PolicyTypeRecord[];
  /** Saves the values; resolves with the errors to show instead of closing. */
  onSave: (values: CarrierPolicyValues) => Promise<CarrierPolicyError[]>;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function CarrierPolicyDialog({ editor, onClose, ...formProps }: CarrierPolicyDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? <CarrierPolicyForm id={id} editor={editor} close={close} {...formProps} /> : null}
    </ModalDialog>
  );
}

type CarrierPolicyFormProps = Omit<CarrierPolicyDialogProps, "editor" | "onClose"> & {
  id: string;
  editor: CarrierPolicyEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function CarrierPolicyForm({
  id,
  editor,
  carrierName,
  carrierStates,
  policyTypes,
  onSave,
  close,
}: CarrierPolicyFormProps) {
  const editing = editor.mode === "edit" ? editor.policy : undefined;
  const [errors, setErrors] = useState<CarrierPolicyError[]>([]);
  const [saving, setSaving] = useState(false);

  // Active types, plus the edited policy's own type so an inactive or deleted
  // one still shows as the current choice rather than silently changing.
  const typeOptions = policyTypes
    .filter((type) => type.status === "active" || type.id === editing?.policyTypeId)
    .map((type) => ({ id: type.id, name: type.name }));
  if (editing?.policyTypeId && !typeOptions.some((type) => type.id === editing.policyTypeId)) {
    typeOptions.unshift({ id: editing.policyTypeId, name: editing.policyTypeName });
  }

  const messageFor = (field: CarrierPolicyError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (field: CarrierPolicyError["field"]) =>
    setErrors((current) => current.filter((error) => error.field !== field));

  const nameError = messageFor("name");
  const statesError = messageFor("availableStates");
  const formError = messageFor("form") ?? messageFor("status");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const values = readCarrierPolicyForm(new FormData(event.currentTarget));
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
        {editing ? `Edit ${editing.name}` : `Add policy for ${carrierName}`}
      </h2>

      {/* Name full width; policy type (left) and status (right) share a row; states below. */}
      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field
          label="Name"
          htmlFor={`${id}-name`}
          required
          hint={nameError ?? undefined}
          hintId={`${id}-name-error`}
          error
          className="sm:col-span-2"
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
        <Field label="Policy type" htmlFor={`${id}-type`}>
          <select
            id={`${id}-type`}
            name="policyType"
            defaultValue={editing?.policyTypeId ?? ""}
            className={INPUT_CLASS}
          >
            <option value="">None</option>
            {typeOptions.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
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

        <StateCheckboxes
          legend="Available states"
          name="availableStates"
          codes={carrierStates}
          defaultChecked={editing?.availableStates}
          onChange={() => clear("availableStates")}
          className="sm:col-span-2"
          legendClassName="font-medium"
          describedBy={statesError ? `${id}-states-error` : undefined}
          footer={
            statesError ? (
              <p id={`${id}-states-error`} className="mt-1 text-xs text-danger">
                {statesError}
              </p>
            ) : null
          }
        >
          {carrierStates.length === 0 ? (
            <p className="mt-2 text-sm text-fg-subtle">{carrierName} has no available states.</p>
          ) : null}
        </StateCheckboxes>
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
          {saving ? "Saving…" : editing ? "Save changes" : "Add policy"}
        </button>
      </div>
    </form>
  );
}
