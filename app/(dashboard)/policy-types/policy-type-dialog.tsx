"use client";

import { useId, useState, type FormEvent } from "react";
import { CarrierCheckboxes } from "@/components/carrier-checkboxes";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import type {
  CarrierRef,
  CertificationScope,
  PolicyTypeError,
  PolicyTypeField,
  PolicyTypeRecord,
  PolicyTypeValues,
} from "@/lib/policy-types";

/*
 * The one Add / Edit policy type dialog: name, status and the certification
 * scope (Not required / Single / Per carrier). Per carrier shows a box for
 * each carrier with an agency contract; checked ones need the certification.
 * A carrier the type already requires stays listed (checked) even when its
 * contract is gone, so the edit shows what is stored; the API then names it.
 * The Policy types page opens it from Add policy type and a row's Edit.
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
  certificationScope: "Certification",
  certificationCarriers: "Certification carriers",
  status: "Status",
};

export const CERTIFICATION_SCOPE_LABELS: Record<CertificationScope, string> = {
  none: "Not required",
  single: "Single",
  per_carrier: "Per carrier",
};

function toScope(value: string): CertificationScope {
  return value === "single" || value === "per_carrier" ? value : "none";
}

type PolicyTypeDialogProps = {
  /** Null keeps the dialog closed. */
  editor: PolicyTypeEditor | null;
  /** Carriers with an agency contract, by name; null when the role can't see agency contracts. */
  contractedCarriers: CarrierRef[] | null;
  /** Saves the values; resolves with the errors to show instead of closing. */
  onSave: (values: PolicyTypeValues) => Promise<PolicyTypeError[]>;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function PolicyTypeDialog({ editor, contractedCarriers, onSave, onClose }: PolicyTypeDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? (
        <PolicyTypeForm
          id={id}
          editor={editor}
          contractedCarriers={contractedCarriers}
          onSave={onSave}
          close={close}
        />
      ) : null}
    </ModalDialog>
  );
}

type PolicyTypeFormProps = Omit<PolicyTypeDialogProps, "editor" | "onClose"> & {
  id: string;
  editor: PolicyTypeEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function PolicyTypeForm({ id, editor, contractedCarriers, onSave, close }: PolicyTypeFormProps) {
  const editing = editor.mode === "edit" ? editor.policyType : undefined;
  const [errors, setErrors] = useState<PolicyTypeError[]>([]);
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<CertificationScope>(editing?.certificationScope ?? "none");
  const [carrierIds, setCarrierIds] = useState<string[]>(
    editing?.certificationCarriers.map((carrier) => carrier.id) ?? [],
  );

  // Contracted carriers, plus any the type already requires that are no longer contracted.
  const carrierOptions = [...(contractedCarriers ?? [])];
  for (const carrier of editing?.certificationCarriers ?? []) {
    if (!carrierOptions.some((option) => option.id === carrier.id)) carrierOptions.push(carrier);
  }
  carrierOptions.sort((a, b) => a.name.localeCompare(b.name));

  const messageFor = (field: PolicyTypeError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (field: PolicyTypeError["field"]) =>
    setErrors((current) => current.filter((error) => error.field !== field));

  const nameError = messageFor("name");
  const scopeError = messageFor("certificationScope");
  const carriersError = messageFor("certificationCarriers");
  const formError = messageFor("form") ?? messageFor("status");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    // Only boxes still on offer count; any other scope sends none.
    const checkedIds =
      scope === "per_carrier"
        ? carrierIds.filter((carrierId) => carrierOptions.some((carrier) => carrier.id === carrierId))
        : [];
    if (scope === "per_carrier" && checkedIds.length === 0) {
      setErrors([{ field: "certificationCarriers", message: "Choose at least one carrier." }]);
      return;
    }
    const values: PolicyTypeValues = {
      name: String(data.get("name") ?? "").trim(),
      certificationScope: scope,
      certificationCarrierIds: checkedIds,
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

      {/* Name full width; status (left) and the certification scope (right) share a row; carriers below. */}
      <div className="mt-5 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
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
        <Field
          label="Certification"
          htmlFor={`${id}-scope`}
          hint={scopeError ?? undefined}
          hintId={`${id}-scope-error`}
          error
        >
          <select
            id={`${id}-scope`}
            name="certificationScope"
            value={scope}
            aria-invalid={scopeError ? true : undefined}
            aria-describedby={scopeError ? `${id}-scope-error` : undefined}
            onChange={(event) => {
              setScope(toScope(event.target.value));
              clear("certificationScope");
              clear("certificationCarriers");
            }}
            className={INPUT_CLASS}
          >
            {(Object.keys(CERTIFICATION_SCOPE_LABELS) as CertificationScope[]).map((value) => (
              <option key={value} value={value}>
                {CERTIFICATION_SCOPE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        {scope === "per_carrier" ? (
          <CarrierCheckboxes
            legend="Carriers requiring certification"
            carriers={carrierOptions}
            checkedIds={carrierIds}
            onChange={(next) => {
              setCarrierIds(next);
              clear("certificationCarriers");
            }}
            emptyText="No carriers have an agency contract yet."
            error={carriersError}
            errorId={`${id}-carriers-error`}
            className="sm:col-span-2"
          />
        ) : null}
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
