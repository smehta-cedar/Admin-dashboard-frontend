"use client";

import { useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { StateCheckboxes } from "@/components/state-checkboxes";
import { formatPhone } from "@/lib/phone";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * The one producer form, shared by the agent dialog (agents/agent-dialog.tsx)
 * and the agency dialog (agency/agency-dialog.tsx): an agent and the agency
 * are both licensed producers with the same eight fields — name, aliases,
 * status, NPN, email, phone, licensed states and the licence number for each
 * checked state (required, so a state can't be added without its number).
 * Only the wording differs, so each dialog passes its `labels`, and the pure
 * save (saveAgent / saveAgency) stays with the dialog.
 *
 * Mounted per open inside a ModalDialog, so its errors start clear each time.
 */

/** The fields both producers share; AgentValues and AgencyValues are exactly this. */
export type ProducerValues = {
  name: string;
  aliases: string[];
  status: "active" | "inactive";
  npn: string;
  email: string;
  phone: string;
  licensedStates: string[];
  licenseNumbers: Record<string, string>;
};

/** A save error, shown under the field it names. */
export type ProducerError = { field: "npn" | "licenseNumbers"; message: string };

/** The words that differ between an agent and the agency. */
export type ProducerLabels = {
  name: string;
  aliases: string;
  aliasesHint: string;
  npn: string;
  licensedHint: string;
};

type ProducerFormProps = {
  /** Prefix for element IDs; the `<h2>` is `${id}-title`, which the dialog is labelled by. */
  id: string;
  title: string;
  description: string;
  submitLabel: string;
  labels: ProducerLabels;
  /** Values to start from; leave out for an empty add form. */
  initial?: ProducerValues;
  /** Saves the values; returns the error to show instead of closing. */
  onSave: (values: ProducerValues) => ProducerError | null;
  close: () => void;
};

/** Input name for one state's licence number. */
const numberField = (code: string) => `licenseNumber-${code}`;

/** A producer's values as notes compare and show them: licence numbers become "TX 2104587" items. */
export const producerNoteValues = (values: ProducerValues) => ({
  ...values,
  licenseNumbers: Object.entries(values.licenseNumbers).map(
    ([code, number]) => `${code} ${number}`,
  ),
});

/** The error `saveAgent` and `saveAgency` both return for a licensed state with no number. */
export const unnumberedStatesError = (values: ProducerValues): ProducerError | null => {
  const unnumbered = values.licensedStates.filter((code) => !values.licenseNumbers[code]);
  if (unnumbered.length === 0) return null;
  return {
    field: "licenseNumbers",
    message: `Enter the licence number for ${unnumbered.join(", ")}, or uncheck ${unnumbered.length === 1 ? "it" : "them"}.`,
  };
};

/** Trimmed values out of the submitted form, licence numbers for checked states only. */
function readValues(form: HTMLFormElement): ProducerValues {
  const data = new FormData(form);
  const text = (field: keyof ProducerValues) => String(data.get(field) ?? "").trim();
  const licensedStates = [
    ...new Set(data.getAll("licensedStates").map((code) => String(code).trim()).filter(Boolean)),
  ].sort();
  return {
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
  };
}

export function ProducerForm({
  id,
  title,
  description,
  submitLabel,
  labels,
  initial,
  onSave,
  close,
}: ProducerFormProps) {
  const [npnError, setNpnError] = useState<string | null>(null);
  const [numbersError, setNumbersError] = useState<string | null>(null);
  // Follows the checkboxes, so each checked state gets a licence number input.
  const [licensedCodes, setLicensedCodes] = useState(initial?.licensedStates ?? []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = onSave(readValues(event.currentTarget));
    if (error) {
      if (error.field === "npn") setNpnError(error.message);
      else setNumbersError(error.message);
      return;
    }
    close();
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {title}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">{description}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label={labels.name} htmlFor={`${id}-name`} className="sm:col-span-2">
          <input
            id={`${id}-name`}
            name="name"
            type="text"
            required
            pattern=".*\S.*"
            autoComplete="off"
            defaultValue={initial?.name}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label={labels.aliases}
          optional
          htmlFor={`${id}-aliases`}
          hint={labels.aliasesHint}
          hintId={`${id}-aliases-hint`}
          className="sm:col-span-2"
        >
          <input
            id={`${id}-aliases`}
            name="aliases"
            type="text"
            autoComplete="off"
            aria-describedby={`${id}-aliases-hint`}
            defaultValue={initial?.aliases.join(", ")}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Status" htmlFor={`${id}-status`}>
          <select
            id={`${id}-status`}
            name="status"
            defaultValue={initial?.status ?? "active"}
            className={INPUT_CLASS}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field
          label={labels.npn}
          htmlFor={`${id}-npn`}
          hint={npnError ?? undefined}
          hintId={`${id}-npn-error`}
          error
        >
          <input
            id={`${id}-npn`}
            name="npn"
            type="text"
            required
            pattern=".*\S.*"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={initial?.npn}
            aria-invalid={npnError ? true : undefined}
            aria-describedby={npnError ? `${id}-npn-error` : undefined}
            onChange={() => setNpnError(null)}
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
            defaultValue={initial?.email}
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
            defaultValue={initial?.phone}
            className={INPUT_CLASS}
          />
        </Field>

        <StateCheckboxes
          legend="Licensed states"
          name="licensedStates"
          defaultChecked={initial?.licensedStates}
          onChange={(codes) => {
            setLicensedCodes(codes);
            setNumbersError(null);
          }}
          className="mt-4 sm:col-span-2"
          legendClassName="font-semibold"
          describedBy={`${id}-licensed-hint`}
        >
          <p id={`${id}-licensed-hint`} className="mt-1 text-xs text-fg-subtle">
            {labels.licensedHint} Each checked state needs its licence number below. Leave all
            unchecked if none.
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
                  <span
                    className="w-7 shrink-0 font-mono text-xs font-medium text-fg-muted"
                    title={US_STATE_NAMES[code]}
                  >
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
                    defaultValue={initial?.licenseNumbers[code]}
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
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
