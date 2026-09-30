"use client";

import { useId, useState, type FormEvent } from "react";
import { CarrierCheckboxes } from "@/components/carrier-checkboxes";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { PdfUpload } from "@/components/pdf-upload";
import type { CertifiablePolicyType } from "@/lib/certification-options";
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
 * The other fields are the same: start date, end date, status, a PDF and
 * the Verified box. When the policy type is certified per carrier the form
 * also shows a box per carrier the certification can cover (the type's
 * carriers that have an agency contract) and needs at least one; for any
 * other type there are no carrier boxes and none are sent.
 *
 * The file input is empty on every open; leaving it empty
 * keeps the stored file, whose name the edit dialog shows. The select
 * offers the active options plus the edited row's own choice when that is
 * inactive (or gone), so an edit never silently moves the row.
 *
 * The view passes `onSave`, which calls the saveCertification server action
 * (./actions.ts) and updates its own state from the saved record. The API
 * keeps one live row per agent and policy type and checks the dates; a
 * duplicate comes back as the API's message under the field the user chose,
 * an end before the start under the end date, a file that is not a PDF or
 * is over 10 MB under the file (checked here first, then by the API, so a
 * large file is not sent at all). While the save is in flight
 * the buttons are disabled.
 */

/** Which dialog is open. Edit holds the row as it was when the dialog opened. */
export type CertificationEditor = { mode: "add" } | { mode: "edit"; certification: CertificationRecord };

export type { CertificationError, CertificationValues } from "@/lib/certifications";

/** Also the order changes are listed in on a note. */
export const CERTIFICATION_FIELD_LABELS: Record<CertificationField, string> = {
  agent: "Agent",
  policyType: "Policy type",
  carriers: "Carriers",
  startDate: "Start date",
  endDate: "End date",
  isVerified: "Verified",
  status: "Status",
  file: "Document",
};

/** The API's limit for a certification's PDF. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Why `file` can't be sent, or null when it can. The API runs the same checks. */
export function certificationFileProblem(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "The file must be a PDF.";
  if (file.size > MAX_FILE_BYTES) return "The file must be 10 MB or smaller.";
  return null;
}

/** One choice for the select: an agent, or a policy type with its scope and carriers. */
export type CertificationOption =
  | { id: string; name: string; status: "active" | "inactive" }
  | CertifiablePolicyType;

/** The side of the pair the page fixes, with its name for the title (and scope, for a policy type). */
export type CertificationFixedSide =
  | { kind: "agent"; agent: { id: string; name: string } }
  | { kind: "policyType"; policyType: CertifiablePolicyType };

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
  const [carrierIds, setCarrierIds] = useState<string[]>(editing?.carriers.map((carrier) => carrier.id) ?? []);
  const [chosenFileName, setChosenFileName] = useState<string | null>(null);

  // The side the form picks, and what the edited row currently has there.
  const picking = fixed.kind === "agent" ? "policyType" : "agent";
  const current = editing
    ? picking === "agent"
      ? { id: editing.agentId, name: editing.agentName }
      : { id: editing.policyTypeId, name: editing.policyTypeName }
    : undefined;
  const [pickedId, setPickedId] = useState(current?.id ?? "");

  // The policy type in play, fixed or picked, for its certification scope and carriers.
  const policyType =
    fixed.kind === "policyType"
      ? fixed.policyType
      : options.find((option): option is CertifiablePolicyType => option.id === pickedId && "carriers" in option);
  const perCarrier = policyType?.certificationScope === "per_carrier";
  const carrierOptions = perCarrier ? policyType.carriers : [];

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
  const carriersError = messageFor("carriers");
  const startError = messageFor("startDate");
  const endError = messageFor("endDate");
  const fileError = messageFor("file");
  const formError = messageFor("form") ?? messageFor("status") ?? messageFor("isVerified");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const picked = String(data.get("picked") ?? "").trim();
    // An empty file input still submits an empty File; that means "keep the current one".
    const chosen = data.get("file");
    const file = chosen instanceof File && chosen.size > 0 ? chosen : null;
    const problem = file ? certificationFileProblem(file) : null;
    if (problem) {
      setErrors([{ field: "file", message: problem }]);
      return;
    }
    // Only boxes on offer for this type count; a type that is not per carrier sends none.
    const checkedIds = carrierIds.filter((carrierId) => carrierOptions.some((carrier) => carrier.id === carrierId));
    if (perCarrier && checkedIds.length === 0) {
      setErrors([{ field: "carriers", message: "Choose at least one carrier." }]);
      return;
    }
    const values: CertificationValues = {
      agentId: fixed.kind === "agent" ? fixed.agent.id : picked,
      policyTypeId: fixed.kind === "policyType" ? fixed.policyType.id : picked,
      carrierIds: checkedIds,
      startDate,
      endDate,
      isVerified: data.get("isVerified") === "yes",
      file,
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

      {/*
        The pick and status share the first row, then the carriers (per-carrier
        types only), the two dates, and the PDF with Verified.
      */}
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
            onChange={(event) => {
              setPickedId(event.target.value);
              clear(picking);
              clear("carriers");
            }}
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
        {perCarrier ? (
          <CarrierCheckboxes
            legend="Carriers"
            carriers={carrierOptions}
            checkedIds={carrierIds}
            onChange={(next) => {
              setCarrierIds(next);
              clear("carriers");
            }}
            emptyText="No contracted carriers need this certification."
            error={carriersError}
            errorId={`${id}-carriers-error`}
            className="sm:col-span-2"
          />
        ) : null}
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
        <Field
          label="Document"
          htmlFor={`${id}-file`}
          hint={fileError ?? undefined}
          hintId={`${id}-file-error`}
          error
        >
          <PdfUpload
            id={`${id}-file`}
            name="file"
            fileName={chosenFileName}
            invalid={fileError ? true : undefined}
            describedBy={fileError ? `${id}-file-error` : undefined}
            onChange={(file) => {
              setChosenFileName(file?.name ?? null);
              clear("file");
            }}
          />
          {editing?.fileName ? (
            <p className="mt-1 truncate text-xs text-fg-muted">Current: {editing.fileName}</p>
          ) : null}
        </Field>
        <div className="flex min-w-0 flex-col justify-end sm:w-40">
          <label className="flex items-center gap-2 py-2 text-sm text-fg">
            <input
              type="checkbox"
              name="isVerified"
              value="yes"
              defaultChecked={editing?.isVerified ?? false}
              className="size-4 accent-brand-strong"
            />
            Verified
          </label>
        </div>
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
