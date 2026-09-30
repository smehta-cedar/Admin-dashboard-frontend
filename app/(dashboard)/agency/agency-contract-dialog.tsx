"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import type { AgencyContractError, AgencyContractRecord, AgencyContractValues } from "@/lib/agency-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import type { PolicyTypeRecord } from "@/lib/policy-types";
import { byName } from "@/lib/text";

/*
 * The one Add / Edit dialog for the agency's contract with a carrier:
 * carrier, contract number, the policy types it covers, status. The agency's
 * login at the carrier is kept on the Passwords page. The agency profile
 * opens it from the Contracts panel's Add contract and a row's Edit; the
 * agency itself is fixed by the profile and never shown as a field.
 *
 * The carrier select offers carriers with no live contract, plus the edited
 * row's own carrier. The policy type boxes list the catalog's active types,
 * plus inactive ones the contract already covers. The API keeps one
 * contract per carrier and records the change note; its messages show under
 * the field. While the save is in flight the buttons are disabled.
 */

/** Which dialog is open. Edit holds the contract as it was when the dialog opened. */
export type AgencyContractEditor = { mode: "add" } | { mode: "edit"; contract: AgencyContractRecord };

export type { AgencyContractError, AgencyContractValues } from "@/lib/agency-contracts";

type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status">;
type PolicyTypeOption = Pick<PolicyTypeRecord, "id" | "name" | "status">;

type AgencyContractDialogProps = {
  /** Null keeps the dialog closed. */
  editor: AgencyContractEditor | null;
  /** Every carrier. */
  carriers: CarrierOption[];
  /** Carriers that already have a live contract; the select leaves them out (except the edited row's). */
  contractedCarrierIds: string[];
  /** Every policy type in the catalog. */
  policyTypes: PolicyTypeOption[];
  /** Saves the values; resolves with the errors to show instead of closing. */
  onSave: (values: AgencyContractValues) => Promise<AgencyContractError[]>;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function AgencyContractDialog({ editor, onClose, ...formProps }: AgencyContractDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? <AgencyContractForm id={id} editor={editor} close={close} {...formProps} /> : null}
    </ModalDialog>
  );
}

type AgencyContractFormProps = Omit<AgencyContractDialogProps, "editor" | "onClose"> & {
  id: string;
  editor: AgencyContractEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its state starts fresh each time. */
function AgencyContractForm({
  id,
  editor,
  carriers,
  contractedCarrierIds,
  policyTypes,
  onSave,
  close,
}: AgencyContractFormProps) {
  const editing = editor.mode === "edit" ? editor.contract : undefined;
  const [errors, setErrors] = useState<AgencyContractError[]>([]);
  const [saving, setSaving] = useState(false);
  const [carrierId, setCarrierId] = useState(editing?.carrierId ?? "");
  const [policyTypeIds, setPolicyTypeIds] = useState<string[]>(
    editing?.policyTypes.map((policyType) => policyType.id) ?? [],
  );

  const taken = new Set(contractedCarrierIds);
  const carrierOptions = carriers
    .filter((carrier) => !taken.has(carrier.id) || carrier.id === editing?.carrierId)
    .sort(byName);

  // Active policy types, plus any the contract already covers.
  const policyTypeOptions = policyTypes
    .filter((policyType) => policyType.status === "active" || policyTypeIds.includes(policyType.id))
    .sort(byName);

  const messageFor = (field: AgencyContractError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (...fields: AgencyContractError["field"][]) =>
    setErrors((current) => current.filter((error) => !fields.includes(error.field)));

  const carrierError = messageFor("carrierId");
  const numberError = messageFor("contractNumber");
  const policyTypesError = messageFor("policyTypeIds");
  const formError = messageFor("form") ?? messageFor("status");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const text = (field: string) => String(data.get(field) ?? "").trim();
    const values: AgencyContractValues = {
      carrierId,
      contractNumber: text("contractNumber"),
      policyTypeIds,
      status: text("status") === "inactive" ? "inactive" : "active",
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
        {editing ? `Edit ${editing.carrierName} contract` : "Add contract"}
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field
          label="Carrier"
          htmlFor={`${id}-carrier`}
          required
          hint={carrierError ?? undefined}
          hintId={`${id}-carrier-error`}
          error
        >
          <select
            id={`${id}-carrier`}
            name="carrierId"
            required
            value={carrierId}
            aria-invalid={carrierError ? true : undefined}
            aria-describedby={carrierError ? `${id}-carrier-error` : undefined}
            onChange={(event) => {
              setCarrierId(event.target.value);
              clear("carrierId");
            }}
            className={INPUT_CLASS}
          >
            <option value="" disabled>
              Choose a carrier
            </option>
            {carrierOptions.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
                {carrier.status !== "active" ? ` (${carrier.status})` : ""}
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

        <Field
          label="Contract number"
          htmlFor={`${id}-number`}
          hint={numberError ?? undefined}
          hintId={`${id}-number-error`}
          error
          className="sm:col-span-2"
        >
          <input
            id={`${id}-number`}
            name="contractNumber"
            type="text"
            maxLength={50}
            autoComplete="off"
            defaultValue={editing?.contractNumber}
            aria-invalid={numberError ? true : undefined}
            aria-describedby={numberError ? `${id}-number-error` : undefined}
            onChange={() => clear("contractNumber")}
            className={INPUT_CLASS}
          />
        </Field>

        <fieldset
          className="sm:col-span-2"
          aria-describedby={policyTypesError ? `${id}-policy-types-error` : undefined}
        >
          <legend className="text-sm font-medium text-fg">Policy types</legend>
          {policyTypeOptions.length === 0 ? (
            <p className="mt-2 text-sm text-fg-subtle">No policy types yet.</p>
          ) : (
            <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {policyTypeOptions.map((policyType) => (
                <label key={policyType.id} className="flex items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={policyTypeIds.includes(policyType.id)}
                    onChange={(event) => {
                      const { checked } = event.target;
                      setPolicyTypeIds((current) =>
                        checked
                          ? [...current, policyType.id]
                          : current.filter((policyTypeId) => policyTypeId !== policyType.id),
                      );
                      clear("policyTypeIds");
                    }}
                    className="size-4 accent-brand-strong"
                  />
                  {policyType.name}
                  {policyType.status === "inactive" ? (
                    <span className="text-fg-subtle"> (inactive)</span>
                  ) : null}
                </label>
              ))}
            </div>
          )}
          {policyTypesError ? (
            <p id={`${id}-policy-types-error`} className="mt-1 text-xs text-danger">
              {policyTypesError}
            </p>
          ) : null}
        </fieldset>
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
          {saving ? "Saving…" : editing ? "Save changes" : "Add contract"}
        </button>
      </div>
    </form>
  );
}
