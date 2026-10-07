"use client";

import { useState, type KeyboardEvent } from "react";
import { carrierChoices, certificationFileProblem } from "@/app/(dashboard)/certifications/certification-dialog";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DeleteIcon } from "@/components/delete-icon";
import { EditIcon } from "@/components/edit-icon";
import { Field } from "@/components/field";
import { PdfUpload } from "@/components/pdf-upload";
import { PROFILE_BUTTON_CLASS, PROFILE_LINK_CLASS } from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import { linesFor, type CertifiableCarrier } from "@/lib/certification-options";
import type { CertificationStatus } from "@/lib/certifications";
import type { CertificateDraft } from "./certificate-draft";
import { formatLicenceDate } from "@/lib/state-licenses";

/*
 * Certifications on the Add agent page. The agent does not exist yet, so
 * these stay on the page until the agent is saved, and the page then creates
 * each one for that agent. The entry row is hidden until Add certification,
 * the same way licences are, and the list is what gets saved.
 *
 * Every field is optional: carrier, line of business (the carrier's own
 * lines, or every line with no carrier), due date (blank lets the API set
 * the next deadline), dates and status. Nothing is checked but the PDF: a
 * certification is an add-on.
 *
 * Each row may carry a PDF and the Verified flag. A picked PDF stays in the
 * browser until the save sends it; a row that already has a stored file
 * keeps it unless another is picked.
 */

type CertificateSectionProps = {
  /** Prefix for element IDs, the agent form's id. */
  idPrefix: string;
  carriers: CertifiableCarrier[];
  drafts: CertificateDraft[];
  onChange: (drafts: CertificateDraft[]) => void;
  /**
   * Deletes a certification that already exists. Resolves with an error
   * message to keep the row. Omit it on Add, where the row is only local.
   */
  onRemove?: (draft: CertificateDraft) => Promise<string | null>;
};

type Entry = {
  carrierId: string;
  lineOfBusiness: string;
  dueDate: string;
  startDate: string;
  endDate: string;
  isVerified: boolean;
  /** A newly picked PDF; null keeps what the row had. */
  file: File | null;
  status: CertificationStatus;
};

const EMPTY_ENTRY: Entry = {
  carrierId: "",
  lineOfBusiness: "",
  dueDate: "",
  startDate: "",
  endDate: "",
  isVerified: false,
  file: null,
  status: "active",
};

let nextDraftId = 0;

/** What a row is called in labels, e.g. "Humana MAPD". */
function draftLabel(draft: CertificateDraft): string {
  return [draft.carrierName, draft.lineOfBusiness].filter(Boolean).join(" ") || "untitled";
}

export function CertificateSection({ idPrefix, carriers, drafts, onChange, onRemove }: CertificateSectionProps) {
  const [entryOpen, setEntryOpen] = useState(false);
  const [entry, setEntry] = useState<Entry>(EMPTY_ENTRY);
  const [held, setHeld] = useState<CertificateDraft | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  /** Bumped to empty the file input whenever the entry row resets. */
  const [fileInputKey, setFileInputKey] = useState(0);
  /** Id of the certification waiting on the delete confirmation, or null. */
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const id = `${idPrefix}-certificate`;
  const choices = carrierChoices(
    carriers,
    held?.carrierId ? { id: held.carrierId, name: held.carrierName } : undefined,
  );
  const lines = linesFor(carriers, entry.carrierId, held?.lineOfBusiness);

  const closeEntry = (restore: CertificateDraft | null) => {
    if (restore) onChange([...drafts, restore]);
    setHeld(null);
    setEntryOpen(false);
    resetEntry(EMPTY_ENTRY);
  };

  const resetEntry = (next: Entry) => {
    setEntry(next);
    setFileError(null);
    setFileInputKey((key) => key + 1);
  };

  const openEntry = () => {
    setHeld(null);
    resetEntry(EMPTY_ENTRY);
    setEntryOpen(true);
  };

  const addCertificate = () => {
    if (fileError) return;
    const draft: CertificateDraft = {
      id: held?.id ?? `new-${++nextDraftId}`,
      carrierId: entry.carrierId,
      carrierName: choices.find((carrier) => carrier.id === entry.carrierId)?.name ?? "",
      lineOfBusiness: entry.lineOfBusiness,
      dueDate: entry.dueDate,
      startDate: entry.startDate,
      endDate: entry.endDate,
      isVerified: entry.isVerified,
      file: entry.file ?? held?.file ?? null,
      fileName: held?.fileName ?? null,
      status: entry.status,
    };
    onChange([...drafts, draft]);
    setHeld(null);
    setEntryOpen(false);
    resetEntry(EMPTY_ENTRY);
  };

  const editCertificate = (draftId: string) => {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft) return;
    onChange(drafts.filter((item) => item.id !== draftId));
    setHeld(draft);
    resetEntry({
      carrierId: draft.carrierId,
      lineOfBusiness: draft.lineOfBusiness,
      dueDate: draft.dueDate,
      startDate: draft.startDate,
      endDate: draft.endDate,
      isVerified: draft.isVerified,
      file: null,
      status: draft.status,
    });
    setEntryOpen(true);
  };

  const addOnEnter = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" || event.defaultPrevented) return;
    if ((event.target as HTMLElement).tagName === "BUTTON") return;
    event.preventDefault();
    addCertificate();
  };

  const update = (patch: Partial<Entry>) => {
    setEntry((current) => ({ ...current, ...patch }));
  };

  const pending = drafts.find((draft) => draft.id === pendingDelete);
  // What the held row already has: a PDF picked earlier on this page, or the stored one.
  const currentFileName = held ? (held.file?.name ?? held.fileName) : null;

  return (
    <>
    <section className="min-w-0 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">Certifications</h3>
        {entryOpen ? null : (
          <button type="button" onClick={openEntry} className={PROFILE_BUTTON_CLASS}>
            <span aria-hidden="true">+ </span>Add certification
          </button>
        )}
      </div>

      {entryOpen || drafts.length > 0 ? (
      <div className="mt-3 grid gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-fg">
            Added
            {drafts.length > 0 ? <span className="font-normal text-fg-subtle"> ({drafts.length})</span> : null}
          </p>
          {drafts.length === 0 ? (
            <p className="text-sm text-fg-subtle">No certifications added yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-hover text-xs text-fg-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Action
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Carrier
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Line of business
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Due date
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Completion date
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Expiry date
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Document
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Verified
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {drafts.map((draft) => (
                    <tr key={draft.id} className="text-fg">
                      <td className="px-3 py-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => editCertificate(draft.id)}
                          className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
                        >
                          <EditIcon className="size-3.5 shrink-0" />
                          <span className="sr-only"> {draftLabel(draft)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(draft.id)}
                          aria-label={`Delete the ${draftLabel(draft)} certification`}
                          title="Delete"
                          className={`inline-flex items-center ${ROW_BUTTON_CLASS} hover:text-danger`}
                        >
                          <DeleteIcon className="size-3.5 shrink-0" />
                        </button>
                      </td>
                      <td className="px-3 py-2">{draft.carrierName || "—"}</td>
                      <td className="px-3 py-2">{draft.lineOfBusiness || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {draft.dueDate ? formatLicenceDate(draft.dueDate) : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {draft.startDate ? formatLicenceDate(draft.startDate) : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {draft.endDate ? formatLicenceDate(draft.endDate) : "—"}
                      </td>
                      <td className="max-w-48 truncate px-3 py-2">
                        {draft.file ? (
                          draft.file.name
                        ) : draft.fileName ? (
                          <a
                            href={`/certifications/${encodeURIComponent(draft.id)}/file`}
                            className={PROFILE_LINK_CLASS}
                          >
                            {draft.fileName}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">{draft.isVerified ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={draft.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {entryOpen ? (
          <div className="min-w-0 mt-7">
            <div
              role="group"
              aria-label="New certification"
              className="grid items-end gap-3 grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]"
              onKeyDown={addOnEnter}
            >
              <Field label="Carrier" htmlFor={`${id}-carrier`}>
                <select
                  id={`${id}-carrier`}
                  value={entry.carrierId}
                  onChange={(event) => {
                    const carrierId = event.target.value;
                    // A line the new carrier doesn't write goes back to none.
                    const keep = linesFor(carriers, carrierId, held?.lineOfBusiness).includes(entry.lineOfBusiness);
                    update({ carrierId, ...(keep ? {} : { lineOfBusiness: "" }) });
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
                  value={entry.lineOfBusiness}
                  onChange={(event) => update({ lineOfBusiness: event.target.value })}
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
                  type="date"
                  value={entry.dueDate}
                  onChange={(event) => update({ dueDate: event.target.value })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Status" htmlFor={`${id}-status`}>
                <select
                  id={`${id}-status`}
                  value={entry.status}
                  onChange={(event) =>
                    update({ status: event.target.value === "inactive" ? "inactive" : "active" })
                  }
                  className={INPUT_CLASS}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
              <Field label="Completion date" htmlFor={`${id}-start`}>
                <input
                  id={`${id}-start`}
                  type="date"
                  value={entry.startDate}
                  onChange={(event) => update({ startDate: event.target.value })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Expiry date" htmlFor={`${id}-end`}>
                <input
                  id={`${id}-end`}
                  type="date"
                  value={entry.endDate}
                  onChange={(event) => update({ endDate: event.target.value })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field
                label="Document"
                htmlFor={`${id}-file`}
                className="col-span-2"
                hint={fileError ?? undefined}
                hintId={`${id}-file-error`}
                error
              >
                <PdfUpload
                  key={fileInputKey}
                  id={`${id}-file`}
                  fileName={entry.file?.name}
                  invalid={fileError ? true : undefined}
                  describedBy={fileError ? `${id}-file-error` : undefined}
                  onChange={(file) => {
                    setFileError(file ? certificationFileProblem(file) : null);
                    setEntry((current) => ({ ...current, file }));
                  }}
                />
                {currentFileName ? (
                  <p className="mt-1 truncate text-xs text-fg-muted">Current: {currentFileName}</p>
                ) : null}
              </Field>
              <label className="flex items-center gap-2 mt-6 self-start py-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={entry.isVerified}
                  onChange={(event) => update({ isVerified: event.target.checked })}
                  className="size-4 accent-brand-strong"
                />
                Verified
              </label>
              <div className="mt-6 flex justify-end gap-2 self-start">
                <button type="button" onClick={() => closeEntry(held)} className={GHOST_BUTTON_CLASS}>
                  Cancel
                </button>
                <button type="button" onClick={addCertificate} className={`${PRIMARY_BUTTON_CLASS} whitespace-nowrap`}>
                  {held ? "Update" : "Add"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}
      {removeError ? (
        <p role="alert" className="mt-3 text-xs text-danger">
          {removeError}
        </p>
      ) : null}
    </section>
    <ConfirmDialog
      open={pendingDelete !== null}
      title="Delete certification"
      message={pending ? `Delete the ${draftLabel(pending)} certification?` : ""}
      onConfirm={async () => {
        const draft = drafts.find((item) => item.id === pendingDelete);
        if (!draft) return;
        if (onRemove) {
          const message = await onRemove(draft);
          if (message) {
            setRemoveError(message);
            return;
          }
        }
        setRemoveError(null);
        onChange(drafts.filter((item) => item.id !== pendingDelete));
      }}
      onClose={() => setPendingDelete(null)}
    />
    </>
  );
}
