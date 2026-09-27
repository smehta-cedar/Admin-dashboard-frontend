"use client";

import { useId } from "react";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { ProducerForm, type ProducerError, type ProducerLabels } from "@/components/producer-form";
import type { AgencyField, AgencyRecord, AgencyValues } from "@/lib/agency";

/*
 * The Edit agency dialog: the shared ProducerForm (components/producer-form.tsx)
 * with org-flavoured labels — name, DBA names, status, agency NPN, email,
 * phone, licensed states and the licence number for each checked state. Edit
 * only: there is one agency, so nothing is ever added here.
 *
 * The agency profile passes `onSave`, which calls the saveAgency server
 * action (./actions.ts): the API keeps the licence rows in step with the
 * checked states and records the change note. The form checks that every
 * checked state has a number before calling it.
 */

export type { AgencyValues } from "@/lib/agency";

/** A save error, shown under the field it names. */
export type AgencyError = ProducerError;

/** Also the order changes are listed in on a note. */
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

const FORM_LABELS: ProducerLabels = {
  name: "Agency name",
  aliases: "Other names",
  aliasesHint: "DBA and other names on statements, separated by commas.",
  npn: "Agency NPN",
  licensedHint: "Where the agency holds a licence.",
};

type AgencyDialogProps = {
  /** The agency to edit, or null to keep the dialog closed. */
  editing: AgencyRecord | null;
  /** Saves the values; resolves with the error to show instead of closing. */
  onSave: (values: AgencyValues) => Promise<AgencyError | null>;
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
          description="Saving records a note of what changed on this page."
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
