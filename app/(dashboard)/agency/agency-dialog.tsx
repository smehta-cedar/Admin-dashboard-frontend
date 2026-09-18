"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { StateCheckboxes } from "@/components/state-checkboxes";
import type { AgencyField, AgencyNote, AgencyRecord } from "@/lib/agency";
import { diffValues, nextId } from "@/lib/change-notes";
import { formatPhone } from "@/lib/phone";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * The Edit agency dialog: the same form as an agent (agent-dialog.tsx) with
 * org-flavoured labels — name, DBA names, status, agency NPN, email, phone,
 * licensed states and the licence number for each checked state. Edit only:
 * there is one agency, so nothing is ever added. The agency profile owns the
 * agency and notes state and passes `onSave`, which calls `saveAgency` below.
 * Edits are dummy: nothing reaches a server, and a refresh brings back the JSON.
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

/** Input name for one state's licence number. */
const numberField = (code: string) => `licenseNumber-${code}`;

/** The agency's values as notes compare and show them: licence numbers become "TX 2104587" items. */
const noteValues = (values: AgencyValues) => ({
  ...values,
  licenseNumbers: Object.entries(values.licenseNumbers).map(
    ([code, number]) => `${code} ${number}`,
  ),
});

type SaveInput = {
  /** Every agency note, so the new note's ID is unique. */
  notes: AgencyNote[];
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
    };

/**
 * Edits the agency, pure. Returns the saved agency and the next notes (a note
 * only when something changed), or the error to show: a licensed state with
 * no licence number. There is no uniqueness check: nothing else has an agency NPN.
 */
export function saveAgency({ notes, values, editing }: SaveInput): SaveResult {
  // The inputs are required too; this holds for any caller.
  const unnumbered = values.licensedStates.filter((code) => !values.licenseNumbers[code]);
  if (unnumbered.length > 0) {
    return {
      error: {
        field: "licenseNumbers",
        message: `Enter the licence number for ${unnumbered.join(", ")}, or uncheck ${unnumbered.length === 1 ? "it" : "them"}.`,
      },
      agency: null,
    };
  }

  const changes = diffValues(FIELDS, noteValues(editing), noteValues(values));
  // Saving with nothing changed just closes, without a note.
  if (changes.length === 0) return { error: null, agency: values, changed: false, notes };

  return {
    error: null,
    agency: values,
    changed: true,
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
      {editing ? <AgencyForm id={id} editing={editing} onSave={onSave} close={close} /> : null}
    </ModalDialog>
  );
}

type AgencyFormProps = Pick<AgencyDialogProps, "onSave"> & {
  id: string;
  editing: AgencyRecord;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function AgencyForm({ id, editing, onSave, close }: AgencyFormProps) {
  const [numbersError, setNumbersError] = useState<string | null>(null);
  // Follows the checkboxes, so each checked state gets a licence number input.
  const [licensedCodes, setLicensedCodes] = useState(editing.licensedStates);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (field: AgencyField) => String(data.get(field) ?? "").trim();
    const licensedStates = [
      ...new Set(data.getAll("licensedStates").map((code) => String(code).trim()).filter(Boolean)),
    ].sort();
    const error = onSave({
      name: text("name"),
      aliases: text("aliases")
        .split(",")
        .map((alias) => alias.trim())
        .filter(Boolean),
      status: text("status") === "inactive" ? "inactive" : "active",
      npn: text("npn"),
      email: text("email"),
      phone: formatPhone(text("phone")),
      licensedStates,
      // Only checked states have an input, and it is required.
      licenseNumbers: Object.fromEntries(
        licensedStates.flatMap((code) => {
          const number = String(data.get(numberField(code)) ?? "").trim();
          return number ? [[code, number]] : [];
        }),
      ),
    });
    if (error) {
      setNumbersError(error.message);
      return;
    }
    close();
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        Edit {editing.name}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        Saving records a note of what changed. Nothing is saved anywhere yet; refreshing undoes it.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Agency name" htmlFor={`${id}-name`} className="sm:col-span-2">
          <input
            id={`${id}-name`}
            name="name"
            type="text"
            required
            pattern=".*\S.*"
            autoComplete="off"
            defaultValue={editing.name}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Other names"
          optional
          htmlFor={`${id}-aliases`}
          hint="DBA and other names on statements, separated by commas."
          hintId={`${id}-aliases-hint`}
          className="sm:col-span-2"
        >
          <input
            id={`${id}-aliases`}
            name="aliases"
            type="text"
            autoComplete="off"
            aria-describedby={`${id}-aliases-hint`}
            defaultValue={editing.aliases.join(", ")}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Status" htmlFor={`${id}-status`}>
          <select
            id={`${id}-status`}
            name="status"
            defaultValue={editing.status}
            className={INPUT_CLASS}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field label="Agency NPN" htmlFor={`${id}-npn`}>
          <input
            id={`${id}-npn`}
            name="npn"
            type="text"
            required
            pattern=".*\S.*"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={editing.npn}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Email" htmlFor={`${id}-email`}>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            autoComplete="off"
            defaultValue={editing.email}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Phone" htmlFor={`${id}-phone`}>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            required
            pattern=".*\S.*"
            autoComplete="off"
            defaultValue={editing.phone}
            className={INPUT_CLASS}
          />
        </Field>

        <StateCheckboxes
          legend="Licensed states"
          name="licensedStates"
          defaultChecked={editing.licensedStates}
          onChange={(codes) => {
            setLicensedCodes(codes);
            setNumbersError(null);
          }}
          className="mt-4 sm:col-span-2"
          legendClassName="font-semibold"
          describedBy={`${id}-licensed-hint`}
        >
          <p id={`${id}-licensed-hint`} className="mt-1 text-xs text-fg-subtle">
            Where the agency holds a licence. Each checked state needs its licence number
            below. Leave all unchecked if none.
          </p>
        </StateCheckboxes>

        {licensedCodes.length > 0 ? (
          <fieldset className="min-w-0 sm:col-span-2">
            <legend className="text-sm font-semibold text-fg">Licence numbers</legend>
            <p className="mt-1 text-xs text-fg-subtle">
              The number each state issued. Required for every checked state; unchecking a state
              drops its number.
            </p>
            <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {licensedCodes.map((code) => (
                <label key={code} className="flex items-center gap-2 text-sm text-fg">
                  <span className="w-7 shrink-0 font-mono text-xs font-medium text-fg-muted" title={US_STATE_NAMES[code]}>
                    {code}
                  </span>
                  <span className="sr-only">{US_STATE_NAMES[code] ?? code} licence number</span>
                  <input
                    name={numberField(code)}
                    type="text"
                    required
                    pattern=".*\S.*"
                    autoComplete="off"
                    aria-invalid={numbersError ? true : undefined}
                    aria-describedby={numbersError ? `${id}-numbers-error` : undefined}
                    onChange={() => setNumbersError(null)}
                    defaultValue={editing.licenseNumbers[code]}
                    className={`${INPUT_CLASS} mt-0!`}
                  />
                </label>
              ))}
            </div>
            {numbersError ? (
              <p id={`${id}-numbers-error`} className="mt-1 text-xs text-danger">
                {numbersError}
              </p>
            ) : null}
          </fieldset>
        ) : null}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={close} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" className={PRIMARY_BUTTON_CLASS}>
          Save changes
        </button>
      </div>
    </form>
  );
}
