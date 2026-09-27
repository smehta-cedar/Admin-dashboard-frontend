"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import type {
  CertificationError,
  CertificationField,
  CertificationRecord,
  CertificationValues,
} from "@/lib/certifications";

/*
 * The one Add / Edit certification dialog, used from two places with one
 * side of the pair fixed:
 *
 *   agent profile      — the agent is fixed; the form picks the policy type
 *   policy types table — the policy type is fixed; the form picks the agent
 *
 * The other fields are the same: start date, end date, status. The select
 * offers the active options plus the edited row's own choice when that is
 * inactive (or gone), so an edit never silently moves the row.
 *
 * The view passes `onSave`, which calls the saveCertification server action
 * (./actions.ts) and updates its own state from the saved record. The API
 * keeps one live row per agent and policy type and checks the dates; a
 * duplicate comes back as the API's message under the field the user chose,
 * an end before the start under the end date. While the save is in flight
 * the buttons are disabled.
 */

/** Which dialog is open. Edit holds the row as it was when the dialog opened. */
export type CertificationEditor = { mode: "add" } | { mode: "edit"; certification: CertificationRecord };

export type { CertificationError, CertificationValues } from "@/lib/certifications";

/** Also the order changes are listed in on a note. */
export const CERTIFICATION_FIELD_LABELS: Record<CertificationField, string> = {
  agent: "Agent",
  policyType: "Policy type",
  startDate: "Start date",
  endDate: "End date",
  status: "Status",
};

/** One choice for the select: an agent or a policy type. */
export type CertificationOption = { id: string; name: string; status: "active" | "inactive" };

/** The side of the pair the page fixes, with its name for the title. */
export type CertificationFixedSide =
  | { kind: "agent"; agent: { id: string; name: string } }
  | { kind: "policyType"; policyType: { id: string; name: string } };

type CertificationDialogProps = {
  /** Null keeps the dialog closed. */
  editor: CertificationEditor | null;
  fixed: CertificationFixedSide;
  /** Every option for the side the form picks; the select shows the active ones. */
  options: CertificationOption[];
  /** Saves the values; resolves with the errors to show instead of closing. */
  onSave: (values: CertificationValues) => Promise<CertificationError[]>;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function CertificationDialog({ editor, onClose, ...formProps }: CertificationDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? <CertificationForm id={id} editor={editor} close={close} {...formProps} /> : null}
    </ModalDialog>
  );
}

type CertificationFormProps = Omit<CertificationDialogProps, "editor" | "onClose"> & {
  id: string;
  editor: CertificationEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its errors and dates start fresh each time. */
function CertificationForm({ id, editor, fixed, options, onSave, close }: CertificationFormProps) {
  const editing = editor.mode === "edit" ? editor.certification : undefined;
  const [errors, setErrors] = useState<CertificationError[]>([]);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState(editing?.startDate ?? "");
  const [endDate, setEndDate] = useState(editing?.endDate ?? "");

  // The side the form picks, and what the edited row currently has there.
  const picking = fixed.kind === "agent" ? "policyType" : "agent";
  const current = editing
    ? picking === "agent"
      ? { id: editing.agentId, name: editing.agentName }
      : { id: editing.policyTypeId, name: editing.policyTypeName }
    : undefined;

  // Active options, plus the edited row's own choice when it is inactive or gone.
  const choices = options
    .filter((option) => option.status === "active" || option.id === current?.id)
    .map((option) => ({ id: option.id, name: option.name }));
  if (current && !choices.some((option) => option.id === current.id)) {
    choices.unshift(current);
  }

  const messageFor = (field: CertificationError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (field: CertificationError["field"]) =>
    setErrors((existing) => existing.filter((error) => error.field !== field));

  const pickError = messageFor(picking);
  const startError = messageFor("startDate");
  const endError = messageFor("endDate");
  const formError = messageFor("form") ?? messageFor("status");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const picked = String(data.get("picked") ?? "").trim();
    const values: CertificationValues = {
      agentId: fixed.kind === "agent" ? fixed.agent.id : picked,
      policyTypeId: fixed.kind === "policyType" ? fixed.policyType.id : picked,
      startDate,
      endDate,
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

  const fixedName = fixed.kind === "agent" ? fixed.agent.name : fixed.policyType.name;
  const title = editing
    ? `Edit ${editing.agentName} · ${editing.policyTypeName}`
    : fixed.kind === "agent"
      ? `Certify ${fixedName}`
      : `Add certification for ${fixedName}`;

  return (
    <form onSubmit={handleSubmit} className="px-6 py-4">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {title}
      </h2>

      {/* The pick and status share the first row; the two dates the second. */}
      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field
          label={picking === "agent" ? "Agent" : "Policy type"}
          htmlFor={`${id}-picked`}
          required
          hint={pickError ?? undefined}
          hintId={`${id}-picked-error`}
          error
        >
          <select
            id={`${id}-picked`}
            name="picked"
            required
            defaultValue={current?.id ?? ""}
            aria-invalid={pickError ? true : undefined}
            aria-describedby={pickError ? `${id}-picked-error` : undefined}
            onChange={() => clear(picking)}
            className={INPUT_CLASS}
          >
            <option value="" disabled>
              {picking === "agent" ? "Choose an agent" : "Choose a policy type"}
            </option>
            {choices.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
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
          label="Start date"
          htmlFor={`${id}-start`}
          hint={startError ?? undefined}
          hintId={`${id}-start-error`}
          error
        >
          <input
            id={`${id}-start`}
            type="date"
            value={startDate}
            aria-invalid={startError ? true : undefined}
            aria-describedby={startError ? `${id}-start-error` : undefined}
            onChange={(event) => {
              setStartDate(event.target.value);
              clear("startDate");
              clear("endDate");
            }}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="End date"
          htmlFor={`${id}-end`}
          hint={endError ?? undefined}
          hintId={`${id}-end-error`}
          error
        >
          <input
            id={`${id}-end`}
            type="date"
            min={startDate || undefined}
            value={endDate}
            aria-invalid={endError ? true : undefined}
            aria-describedby={endError ? `${id}-end-error` : undefined}
            onChange={(event) => {
              setEndDate(event.target.value);
              clear("endDate");
            }}
            className={INPUT_CLASS}
          />
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
          {saving ? "Saving…" : editing ? "Save changes" : "Add certification"}
        </button>
      </div>
    </form>
  );
}
