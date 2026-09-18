"use client";

import { useId } from "react";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import {
  ProducerForm,
  producerNoteValues,
  unnumberedStatesError,
  type ProducerLabels,
} from "@/components/producer-form";
import type { AgencyField, AgencyNote, AgencyRecord } from "@/lib/agency";
import type { AgencyStateLicenseRecord } from "@/lib/agency-state-licenses";
import { diffValues, nextId } from "@/lib/change-notes";
import { applyLicenceEdits, licenseNumbersOf, licensedStatesOf } from "@/lib/state-licenses";

/*
 * The Edit agency dialog: the shared ProducerForm (components/producer-form.tsx)
 * with org-flavoured labels — name, DBA names, status, agency NPN, email,
 * phone, licensed states and the licence number for each checked state. Edit
 * only: there is one agency, so nothing is ever added.
 *
 * The states and numbers the form edits are the agency's state licence rows
 * (lib/agency-state-licenses.ts): `saveAgency` updates those rows and derives
 * the saved agency's licensedStates / licenseNumbers from them, the way
 * lib/agency.ts does when it loads. The agency profile owns the agency,
 * licence rows and notes state and passes `onSave`, which calls `saveAgency`
 * below. Edits are dummy: nothing reaches a server, and a refresh brings back
 * the JSON.
 */

export type AgencyValues = AgencyRecord;

/** A save error, shown under the field it names. */
export type AgencyError = { field: "licenseNumbers"; message: string };

/** Also the order changes are compared and listed in. */
export const AGENCY_FIELD_LABELS: Record<AgencyField, string> = {
  name: "Agency name",
  aliases: "Other names",
  status: "Status",
  npn: "Agency NPN",
  email: "Email",
  phone: "Phone",
  licensedStates: "Licensed states",
  licenseNumbers: "Licence numbers",
};

const FIELDS = Object.keys(AGENCY_FIELD_LABELS) as AgencyField[];

const FORM_LABELS: ProducerLabels = {
  name: "Agency name",
  aliases: "Other names",
  aliasesHint: "DBA and other names on statements, separated by commas.",
  npn: "Agency NPN",
  licensedHint: "Where the agency holds a licence.",
};

type SaveInput = {
  /** Every agency note, so the new note's ID is unique. */
  notes: AgencyNote[];
  /** The agency's licence rows (all of them are its own). */
  licenses: AgencyStateLicenseRecord[];
  values: AgencyValues;
  /** The agency as it was when the dialog opened. */
  editing: AgencyRecord;
};

type SaveResult =
  | { error: AgencyError; agency: null }
  | {
      error: null;
      /** The agency as saved; on an edit that changed nothing, the record as it was. */
      agency: AgencyRecord;
      /** False when the edit changed nothing: no new note. */
      changed: boolean;
      notes: AgencyNote[];
      /** The licence rows after the save. */
      licenses: AgencyStateLicenseRecord[];
    };

/**
 * Edits the agency, pure. Returns the saved agency, the next licence rows and
 * the next notes (a note only when something changed), or the error to show:
 * a licensed state with no licence number. There is no uniqueness check:
 * nothing else has an agency NPN.
 */
export function saveAgency({ notes, licenses, values, editing }: SaveInput): SaveResult {
  // The inputs are required too; this holds for any caller.
  const unnumbered = unnumberedStatesError(values);
  if (unnumbered) return { error: { ...unnumbered, field: "licenseNumbers" }, agency: null };

  // The licence rows are the truth; the agency's two fields are read back from them.
  const nextLicenses = applyLicenceEdits({
    rows: licenses,
    isOwn: () => true,
    values,
    own: (license) => license,
  });
  const saved: AgencyRecord = {
    ...values,
    licensedStates: licensedStatesOf(nextLicenses),
    licenseNumbers: licenseNumbersOf(nextLicenses),
  };
  const changes = diffValues(FIELDS, producerNoteValues(editing), producerNoteValues(saved));
  // Saving with nothing changed just closes, without a note.
  if (changes.length === 0) return { error: null, agency: saved, changed: false, notes, licenses };

  return {
    error: null,
    agency: saved,
    changed: true,
    licenses: nextLicenses,
    notes: [
      { id: nextId(notes), kind: "edited", createdAt: new Date().toISOString(), changes },
      ...notes,
    ],
  };
}

type AgencyDialogProps = {
  /** The agency to edit, or null to keep the dialog closed. */
  editing: AgencyRecord | null;
  /** Saves the values; returns the error to show instead of closing. */
  onSave: (values: AgencyValues) => AgencyError | null;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function AgencyDialog({ editing, onSave, onClose }: AgencyDialogProps) {
  const { dialogRef, close } = useModalDialog(editing !== null);
  const id = useId();

  // Clearing `editing` unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editing ? (
        <ProducerForm
          id={id}
          title={`Edit ${editing.name}`}
          description="Saving records a note of what changed. Nothing is saved anywhere yet; refreshing undoes it."
          submitLabel="Save changes"
          labels={FORM_LABELS}
          initial={editing}
          onSave={onSave}
          close={close}
        />
      ) : null}
    </ModalDialog>
  );
}
