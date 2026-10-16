"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { PdfUpload } from "@/components/pdf-upload";
import { linesFor, type CertifiableCarrier } from "@/lib/certification-options";
import type {
  CertificationError,
  CertificationField,
  CertificationRecord,
  CertificationValues,
} from "@/lib/certifications";
import { certificationLabel } from "./certifications-table";

/*
 * The one Add / Edit certification dialog, opened from the agent profile
 * with the agent fixed. Every field is optional: carrier, line of business
 * (the lines that carrier marks as needing one, or every line when no
 * carrier is chosen), due date (left blank on a new row, the API sets the
 * next deadline), start and
 * end dates, status, a PDF and the Verified box. Nothing is checked but the
 * PDF: a certification is an add-on.
 *
 * The file input is empty on every open; leaving it empty keeps the stored
 * file, whose name the edit dialog shows. The carrier select offers the
 * active carriers plus the edited row's own carrier when that is inactive
 * (or gone), so an edit never silently moves the row.
 *
 * The view passes `onSave`, which calls the saveCertification server action
 * (./actions.ts) and updates its own state from the saved record. A file
 * that is not a PDF or is over 10 MB is named under the file (checked here
 * first, then by the API, so a large file is not sent at all). While the
 * save is in flight the buttons are disabled.
 */

/** Which dialog is open. Edit holds the row as it was when the dialog opened. */
export type CertificationEditor = { mode: "add" } | { mode: "edit"; certification: CertificationRecord };

export type { CertificationError, CertificationValues } from "@/lib/certifications";

/** Also the order changes are listed in on a note. */
export const CERTIFICATION_FIELD_LABELS: Record<CertificationField, string> = {
  agent: "Agent",
  carrier: "Carrier",
  lineOfBusiness: "Line of business",
  dueDate: "Due date",
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

/**
 * The carriers a form offers: the active ones plus `current` (a row's own
 * carrier) when it is inactive or gone, by name.
 */
export function carrierChoices(
  carriers: CertifiableCarrier[],
  current?: { id: string; name: string },
): { id: string; name: string }[] {
  const choices = carriers
    .filter((carrier) => carrier.status === "active" || carrier.id === current?.id)
    .map(({ id, name }) => ({ id, name }));
  if (current?.id && !choices.some((carrier) => carrier.id === current.id)) choices.push(current);
  return choices.sort((a, b) => a.name.localeCompare(b.name));
}

type CertificationDialogProps = {
  /** Null keeps the dialog closed. */
  editor: CertificationEditor | null;
  agent: { id: string; name: string };
  /** Every carrier with its lines; the select shows the active ones. */
  carriers: CertifiableCarrier[];
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

/** The dialog's form. Mounted per open, so its errors and fields start fresh each time. */
function CertificationForm({ id, editor, agent, carriers, onSave, close }: CertificationFormProps) {
  const editing = editor.mode === "edit" ? editor.certification : undefined;
  const [errors, setErrors] = useState<CertificationError[]>([]);
  const [saving, setSaving] = useState(false);
  const [carrierId, setCarrierId] = useState(editing?.carrierId ?? "");
  const [lineOfBusiness, setLineOfBusiness] = useState(editing?.lineOfBusiness ?? "");
  const [chosenFileName, setChosenFileName] = useState<string | null>(null);

  const choices = carrierChoices(
    carriers,
    editing?.carrierId ? { id: editing.carrierId, name: editing.carrierName } : undefined,
  );
  const lines = linesFor(carriers, carrierId, editing?.lineOfBusiness);

  const messageFor = (field: CertificationError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (field: CertificationError["field"]) =>
    setErrors((existing) => existing.filter((error) => error.field !== field));

  const fileError = messageFor("file");
  // Anything else the API says goes under the form.
  const formError = errors.find((error) => error.field !== "file")?.message ?? null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    // An empty file input still submits an empty File; that means "keep the current one".
    const chosen = data.get("file");
    const file = chosen instanceof File && chosen.size > 0 ? chosen : null;
    const problem = file ? certificationFileProblem(file) : null;
    if (problem) {
      setErrors([{ field: "file", message: problem }]);
      return;
    }
    const values: CertificationValues = {
      agentId: agent.id,
      carrierId,
      lineOfBusiness,
      dueDate: String(data.get("dueDate") ?? ""),
      startDate: String(data.get("startDate") ?? ""),
      endDate: String(data.get("endDate") ?? ""),
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

  const title = editing ? `Edit ${agent.name} · ${certificationLabel(editing)}` : `Certify ${agent.name}`;

  return (
    <form onSubmit={handleSubmit} className="px-6 py-4">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {title}
      </h2>

      {/* Carrier and line, then due date and status, the two dates, and the PDF with Verified. */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Carrier" htmlFor={`${id}-carrier`}>
          <select
            id={`${id}-carrier`}
            value={carrierId}
            onChange={(event) => {
              const next = event.target.value;
              setCarrierId(next);
              // A line the new carrier doesn't write goes back to none.
              if (!linesFor(carriers, next, editing?.lineOfBusiness).includes(lineOfBusiness)) setLineOfBusiness("");
            }}
            className={INPUT_CLASS}
          >
            <option value="">None</option>
            {choices.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Line of business" htmlFor={`${id}-line`}>
          <select
            id={`${id}-line`}
            value={lineOfBusiness}
            onChange={(event) => setLineOfBusiness(event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">None</option>
            {lines.map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date" htmlFor={`${id}-due`}>
          <input
            id={`${id}-due`}
            name="dueDate"
            type="date"
            defaultValue={editing?.dueDate ?? ""}
            className={INPUT_CLASS}
          />
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
        <Field label="Completion date" htmlFor={`${id}-start`}>
          <input
            id={`${id}-start`}
            name="startDate"
            type="date"
            defaultValue={editing?.startDate ?? ""}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Expiry date" htmlFor={`${id}-end`}>
          <input
            id={`${id}-end`}
            name="endDate"
            type="date"
            defaultValue={editing?.endDate ?? ""}
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
        <div className="flex min-w-0 flex-col justify-end">
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
