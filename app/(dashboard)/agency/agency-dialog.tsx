"use client";

import { useId } from "react";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { ProducerForm, type ProducerError, type ProducerLabels } from "@/components/producer-form";
import type { AgencyField, AgencyRecord, AgencyValues } from "@/lib/agency";

/*
 * The Edit agency dialog: the shared ProducerForm (components/producer-form.tsx)
 * with org-flavoured labels — name, DBA names, status, agency NPN, email
 * and phone. The form's Licences section is off: the agency's state
 * licences are added, edited and removed one at a time from the profile's
 * State licences panel (./license-dialog.tsx). There is one agency: the
 * dialog adds it ("new") only from the empty Agency page a superuser sees
 * before it exists (./new-agency.tsx), and edits it from then on.
 *
 * The caller passes `onSave`, which calls the createAgency or saveAgency
 * server action (./actions.ts); the API records the change note.
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
  licenseStatuses: "Licence statuses",
  licenseDates: "Licence dates",
};

const FORM_LABELS: ProducerLabels = {
  name: "Agency name",
  aliases: "Other names",
  aliasesHint: "Separate by comma.",
  npn: "Agency NPN",
};

type AgencyDialogProps = {
  /** The agency to edit, "new" to add it, or null to keep the dialog closed. */
  editing: AgencyRecord | "new" | null;
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
      {editing === "new" ? (
        <ProducerForm
          id={id}
          title="Add agency"
          description="Licences and contracts are added from the agency page once it is saved."
          submitLabel="Add agency"
          labels={FORM_LABELS}
          licences={false}
          onSave={onSave}
          close={close}
        />
      ) : editing ? (
        <ProducerForm
          id={id}
          title={`Edit ${editing.name}`}
          description="Saving records a note of what changed on this page."
          submitLabel="Save changes"
          labels={FORM_LABELS}
          initial={editing}
          licences={false}
          onSave={onSave}
          close={close}
        />
      ) : null}
    </ModalDialog>
  );
}
