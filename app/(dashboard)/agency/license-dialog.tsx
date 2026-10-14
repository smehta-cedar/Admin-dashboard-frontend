"use client";

import { useId, useState, type FormEvent } from "react";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { STATE_LICENSE_DIALOG_CLASS, StateLicenseForm } from "@/components/state-license-form";
import type { AgencyStateLicenseRecord } from "@/lib/agency-state-licenses";
import {
  AGENCY_LICENCE_STATUSES,
  licenceDetailsRequired,
  statusForEndDate,
  todayIso,
  type StateLicenseStatus,
} from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * One agency state licence, added or edited on its own from the profile's
 * State licences panel: the state, the licence number, the status (active,
 * pending, applied, expired or cancelled), the lines (Health, Life)
 * and the start and end dates. Editing a listed licence can also remove it,
 * behind a second click so a slip doesn't drop a row.
 *
 * The agency profile passes `onSave` and `onRemove`, which call the
 * saveAgencyLicense / removeAgencyLicense server actions (./actions.ts);
 * each resolves with the message to show under the form, or null to close.
 * Before saving, the form checks a state is picked, the number and end date
 * are filled when the licence is active (other statuses may leave them
 * blank), the state isn't already licensed (unless it is this row's own) and
 * the end date isn't before the start date. An end date before today makes
 * the status Expired.
 *
 * Layout comes from StateLicenseForm (components/state-license-form.tsx).
 * Mounted per open inside a ModalDialog, so its fields and errors start
 * fresh each time.
 */

/** What the form submits for one licence. Dates are YYYY-MM-DD or "". */
export type AgencyLicenseValues = {
  state: string;
  licenseNumber: string;
  status: StateLicenseStatus;
  life: boolean;
  health: boolean;
  startDate: string;
  endDate: string;
};

/** What the dialog is open for: a new licence, or one of the listed rows. */
export type AgencyLicenseEditor = { mode: "add" } | { mode: "edit"; license: AgencyStateLicenseRecord };

type AgencyLicenseDialogProps = {
  /** What to edit, or null to keep the dialog closed. */
  editor: AgencyLicenseEditor | null;
  /** The states already licensed, so a second row for one can't be added. */
  licensedStates: string[];
  /** Saves the licence; `previousState` is the row being edited, or null for a new one. Resolves with the error to show. */
  onSave: (values: AgencyLicenseValues, previousState: string | null) => Promise<string | null>;
  /** Removes the row for `state`. Resolves with the error to show. */
  onRemove: (state: string) => Promise<string | null>;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function AgencyLicenseDialog({ editor, licensedStates, onSave, onRemove, onClose }: AgencyLicenseDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing `editor` unmounts the form, which resets it.
  return (
    <ModalDialog
      dialogRef={dialogRef}
      labelledBy={`${id}-title`}
      onClose={onClose}
      className={STATE_LICENSE_DIALOG_CLASS}
    >
      {editor ? (
        <LicenseForm
          id={id}
          license={editor.mode === "edit" ? editor.license : null}
          licensedStates={licensedStates}
          onSave={onSave}
          onRemove={onRemove}
          close={close}
        />
      ) : null}
    </ModalDialog>
  );
}

type LicenseFormProps = {
  id: string;
  /** The row being edited, or null for a new licence. */
  license: AgencyStateLicenseRecord | null;
  licensedStates: string[];
  onSave: AgencyLicenseDialogProps["onSave"];
  onRemove: AgencyLicenseDialogProps["onRemove"];
  close: () => void;
};

function LicenseForm({ id, license, licensedStates, onSave, onRemove, close }: LicenseFormProps) {
  const [state, setState] = useState(license?.state ?? "");
  const [status, setStatus] = useState<StateLicenseStatus>(license?.status ?? "active");
  const detailsRequired = licenceDetailsRequired(status);
  // The dates are controlled so the end date's `min` can follow the start.
  const [startDate, setStartDate] = useState(license ? license.startDate : todayIso());
  const [endDate, setEndDate] = useState(license?.endDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const stateName = US_STATE_NAMES[state] ?? state;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const values: AgencyLicenseValues = {
      state,
      licenseNumber: String(data.get("licenseNumber") ?? "").trim(),
      status,
      life: data.get("life") === "on",
      health: data.get("health") === "on",
      startDate,
      endDate,
    };

    if (!values.state) {
      setError("Pick a state.");
      return;
    }
    if (!values.licenseNumber && detailsRequired) {
      setError(`Enter the ${stateName} licence number.`);
      return;
    }
    if (!values.endDate && detailsRequired) {
      setError(`Enter the ${stateName} licence end date.`);
      return;
    }
    if (values.state !== license?.state && licensedStates.includes(values.state)) {
      setError(`${stateName} is already licensed. Edit that row instead.`);
      return;
    }
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      setError("The end date must be on or after the start date.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const message = await onSave(values, license?.state ?? null);
      if (message) {
        setError(message);
        return;
      }
      close();
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!license) return;
    setError(null);
    const message = await onRemove(license.state);
    if (message) {
      setError(message);
      return;
    }
    close();
  };

  const title = license ? `Edit ${US_STATE_NAMES[license.state] ?? license.state} licence` : "Add licence";

  return (
    <StateLicenseForm
      id={id}
      title={title}
      description="Saving records a note of what changed on this page."
      state={state}
      onStateChange={setState}
      defaultState={license?.state}
      stateInvalid={Boolean(error) && !state}
      defaultLicenseNumber={license?.licenseNumber}
      numberRequired={detailsRequired}
      endDateRequired={detailsRequired}
      status={status}
      onStatusChange={setStatus}
      statuses={AGENCY_LICENCE_STATUSES}
      showLines
      defaultHealth={license?.health ?? false}
      defaultLife={license?.life ?? false}
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={setStartDate}
      onEndDateChange={(value) => {
        setEndDate(value);
        setStatus((current) => statusForEndDate(current, value));
      }}
      error={error}
      onClearError={() => setError(null)}
      busy={busy}
      canRemove={Boolean(license)}
      onRequestRemove={() => setConfirmingRemove(true)}
      onCancel={close}
      submitLabel={license ? "Save changes" : "Add licence"}
      onSubmit={handleSubmit}
      confirmingRemove={confirmingRemove}
      removeMessage={license ? `Delete the ${US_STATE_NAMES[license.state] ?? license.state} licence?` : ""}
      onConfirmRemove={handleRemove}
      onCloseConfirmRemove={() => setConfirmingRemove(false)}
    />
  );
}
