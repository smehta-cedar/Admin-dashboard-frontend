"use client";

import { useId, useState, type FormEvent } from "react";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { STATE_LICENSE_DIALOG_CLASS, StateLicenseForm } from "@/components/state-license-form";
import {
  AGENT_LICENCE_STATUSES,
  licenceDetailsRequired,
  renewalOpen,
  statusForEndDate,
  todayIso,
  type StateLicense,
  type StateLicenseStatus,
} from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * One agent state licence, added or edited on its own from the profile's
 * State licences panel: the state, the licence number, the status, the lines
 * (Health, Life) and the start and end dates — the same fields as a row on
 * the agent form. Editing a listed
 * licence can also remove it, behind a second click so a slip doesn't drop
 * a row.
 *
 * The profile passes `onSave` and `onRemove`, which replace the agent's
 * licence list through saveAgentLicenses (../actions.ts); each resolves with
 * the message to show under the form, or null to close. Before saving, the
 * form checks a state is picked, the number and end date are filled when the
 * licence is active (other statuses may leave them blank), the state isn't
 * already licensed (unless it is this row's own) and the end date isn't
 * before the start date. An end date before today makes the status Expired.
 *
 * The state list holds only the agency's licensed states (`agencyStates`),
 * plus the row's own state when editing one outside them.
 *
 * Layout comes from StateLicenseForm (components/state-license-form.tsx).
 * Mounted per open inside a ModalDialog, so its fields and errors start
 * fresh each time.
 */

/** What the form submits for one licence. Dates are YYYY-MM-DD or "". */
export type AgentLicenseValues = {
  state: string;
  licenseNumber: string;
  status: StateLicenseStatus;
  life: boolean;
  health: boolean;
  startDate: string;
  endDate: string;
  /** Sent only while the end date is within the renewal window. */
  renewing: boolean;
};

/** What the dialog is open for: a new licence, or one of the listed rows. */
export type AgentLicenseEditor = { mode: "add" } | { mode: "edit"; license: StateLicense };

type AgentLicenseDialogProps = {
  /** What to edit, or null to keep the dialog closed. */
  editor: AgentLicenseEditor | null;
  /** The states already licensed, so a second row for one can't be added. */
  licensedStates: string[];
  /** The agency's licensed states, the only ones offered. Null offers every state. */
  agencyStates: string[] | null;
  /** Saves the licence; `previousState` is the row being edited, or null for a new one. Resolves with the error to show. */
  onSave: (values: AgentLicenseValues, previousState: string | null) => Promise<string | null>;
  /** Removes the row for `state`. Resolves with the error to show. */
  onRemove: (state: string) => Promise<string | null>;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function AgentLicenseDialog({ editor, licensedStates, agencyStates, onSave, onRemove, onClose }: AgentLicenseDialogProps) {
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
          agencyStates={agencyStates}
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
  license: StateLicense | null;
  licensedStates: string[];
  agencyStates: string[] | null;
  onSave: AgentLicenseDialogProps["onSave"];
  onRemove: AgentLicenseDialogProps["onRemove"];
  close: () => void;
};

function LicenseForm({ id, license, licensedStates, agencyStates, onSave, onRemove, close }: LicenseFormProps) {
  const [state, setState] = useState(license?.state ?? "");
  const [status, setStatus] = useState<StateLicenseStatus>(license?.status ?? "active");
  const detailsRequired = licenceDetailsRequired(status);
  // The dates are controlled so the end date's `min` can follow the start.
  const [startDate, setStartDate] = useState(license ? license.startDate : todayIso());
  const [endDate, setEndDate] = useState(license?.endDate ?? "");
  const [renewing, setRenewing] = useState(license?.renewing ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const stateName = US_STATE_NAMES[state] ?? state;
  // An edited row keeps its own state on the list even if the agency has since lost it.
  const allowedStates =
    agencyStates && license && !agencyStates.includes(license.state) ? [...agencyStates, license.state] : agencyStates;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const values: AgentLicenseValues = {
      state,
      licenseNumber: String(data.get("licenseNumber") ?? "").trim(),
      status,
      life: data.get("life") === "on",
      health: data.get("health") === "on",
      startDate,
      endDate,
      renewing: renewing && renewalOpen(endDate),
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

  const title = license ? `Edit ${US_STATE_NAMES[license.state] ?? license.state} licence` : "Add State licence";

  return (
    <StateLicenseForm
      id={id}
      title={title}
      state={state}
      onStateChange={setState}
      defaultState={license?.state}
      allowedStates={allowedStates ?? undefined}
      stateInvalid={Boolean(error) && !state}
      defaultLicenseNumber={license?.licenseNumber}
      numberRequired={detailsRequired}
      endDateRequired={detailsRequired}
      status={status}
      onStatusChange={setStatus}
      statuses={AGENT_LICENCE_STATUSES}
      showLines
      defaultHealth={license?.health ?? false}
      defaultLife={license?.life ?? false}
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={setStartDate}
      renewing={renewing}
      onRenewingChange={setRenewing}
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
