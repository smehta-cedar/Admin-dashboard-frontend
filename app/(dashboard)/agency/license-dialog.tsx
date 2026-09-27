"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { StateSelect } from "@/components/state-select";
import { statusLabel } from "@/components/status-badge";
import type { AgencyStateLicenseRecord } from "@/lib/agency-state-licenses";
import { AGENCY_LICENCE_STATUSES, type StateLicenseStatus } from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * One agency state licence, added or edited on its own from the profile's
 * State licences panel: the state, the licence number, the status (active,
 * pending, review, applied, expired or cancelled) and the start and end
 * dates. Editing a listed licence can also remove it, behind a second click
 * so a slip doesn't drop a row.
 *
 * The agency profile passes `onSave` and `onRemove`, which call the
 * saveAgencyLicense / removeAgencyLicense server actions (./actions.ts);
 * each resolves with the message to show under the form, or null to close.
 * Before saving, the form checks a state is picked, the number is filled,
 * the state isn't already licensed (unless it is this row's own) and the
 * end date isn't before the start date.
 *
 * Mounted per open inside a ModalDialog, so its fields and errors start
 * fresh each time.
 */

/** What the form submits for one licence. Dates are YYYY-MM-DD or "". */
export type AgencyLicenseValues = {
  state: string;
  licenseNumber: string;
  status: StateLicenseStatus;
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
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
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
  // The dates are controlled so the end date's `min` can follow the start.
  const [startDate, setStartDate] = useState(license?.startDate ?? "");
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
      status: String(data.get("status")) as StateLicenseStatus,
      startDate,
      endDate,
    };

    if (!values.state) {
      setError("Pick a state.");
      return;
    }
    if (!values.licenseNumber) {
      setError(`Enter the ${stateName} licence number.`);
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
    if (!license || busy) return;
    setBusy(true);
    setError(null);
    try {
      const message = await onRemove(license.state);
      if (message) {
        setError(message);
        setConfirmingRemove(false);
        return;
      }
      close();
    } finally {
      setBusy(false);
    }
  };

  const title = license ? `Edit ${US_STATE_NAMES[license.state] ?? license.state} licence` : "Add licence";

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {title}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">Saving records a note of what changed on this page.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Field label="State" required htmlFor={`${id}-state`}>
          <StateSelect
            id={`${id}-state`}
            name="state"
            defaultValue={license?.state}
            onChange={(code) => {
              setState(code);
              setError(null);
            }}
            invalid={Boolean(error) && !state}
            describedBy={error ? `${id}-error` : undefined}
          />
        </Field>
        <Field label="Licence number" required htmlFor={`${id}-number`}>
          <input
            id={`${id}-number`}
            name="licenseNumber"
            type="text"
            required
            pattern=".*\S.*"
            autoComplete="off"
            defaultValue={license?.licenseNumber}
            onChange={() => setError(null)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Status" htmlFor={`${id}-status`}>
          <select id={`${id}-status`} name="status" defaultValue={license?.status ?? "active"} className={INPUT_CLASS}>
            {AGENCY_LICENCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date" htmlFor={`${id}-start`}>
          <input
            id={`${id}-start`}
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setError(null);
            }}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="End date" htmlFor={`${id}-end`}>
          <input
            id={`${id}-end`}
            type="date"
            min={startDate || undefined}
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              setError(null);
            }}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <div id={`${id}-error`} role="alert" className="mt-4">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {license ? (
          confirmingRemove ? (
            <>
              <span className="text-sm text-fg-muted">Remove the {stateName} licence?</span>
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className={`${GHOST_BUTTON_CLASS} text-danger hover:text-danger`}
              >
                Yes, remove
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                disabled={busy}
                className={GHOST_BUTTON_CLASS}
              >
                Keep it
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              disabled={busy}
              className={`${GHOST_BUTTON_CLASS} text-danger hover:text-danger`}
            >
              Remove
            </button>
          )
        ) : null}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={close} disabled={busy} className={GHOST_BUTTON_CLASS}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
            {busy ? "Saving…" : license ? "Save changes" : "Add licence"}
          </button>
        </div>
      </div>
    </form>
  );
}
