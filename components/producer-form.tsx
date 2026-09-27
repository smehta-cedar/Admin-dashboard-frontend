"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  GHOST_BUTTON_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  TOOLBAR_INPUT_CLASS,
} from "@/components/classes";
import { Field } from "@/components/field";
import { StateCheckboxes } from "@/components/state-checkboxes";
import { formatPhone } from "@/lib/phone";
import type { LicenceLines } from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * The one producer form, shared by the agent dialog (agents/agent-dialog.tsx),
 * the Add agent page (agents/new) and the agency dialog
 * (agency/agency-dialog.tsx): an agent and the agency are both licensed
 * producers with the same eight fields — name, aliases, status, NPN, email,
 * phone, licensed states and the licence number for each checked state
 * (required, so a state can't be added without its number). Only the wording
 * differs, so each dialog passes its `labels`, and the pure save (saveAgent /
 * saveAgency) stays with the dialog.
 *
 * The fields are grouped into three titled sections, no hint text under the
 * titles:
 *
 *   Identity  — name, NPN and aliases on one line; the status select sits
 *               in the section's header, on the right, Active by default
 *   Contact   — email and phone, then the producer's `extra` fields if it
 *               has any (the agent's personal email, phone and address)
 *   Licences  — the state grid and, for each checked state, its number and
 *               (with `lines`, the agent) a Life and a Health checkbox for
 *               the lines of business the licence covers
 *
 * Two layouts. `dialog` (the default) stacks the sections under the title
 * inside a modal, separated by rules, the fields in two columns. `page` is
 * for a full page: one card per row, capped at the 2xl breakpoint so the
 * inputs never stretch too wide, the fields inside spread over four columns
 * from `xl`, and the state grid and licence numbers side by side. The Cancel
 * and submit buttons sit in a bar stuck to the bottom of the viewport.
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
  /** The Life / Health lines per checked state; empty without `lines` (the agency). */
  licenseLines: Record<string, LicenceLines>;
};

/**
 * A save error, shown under the field it names. "address" is the agent-only
 * section's; "form" is about the attempt itself (no permission, API down)
 * and shows under the form.
 */
export type ProducerError = {
  field: "name" | "npn" | "licenseNumbers" | "address" | "form";
  message: string;
};

/**
 * Column-span classes for a field in the Contact section's grid: two
 * columns from `sm` in both layouts, four from `xl` on the page. A field
 * says how much of a row it wants and these pick the classes.
 */
export type FieldSpans = {
  /** The whole row. */
  full: string;
  /** One field: a quarter of the row on the wide page, half in the dialog. */
  field: string;
  /** The classes for a fieldset's own inner grid of small fields, e.g. an address. */
  innerGrid: string;
};

/**
 * Producer-specific fields for the Contact section, after email and phone.
 * `render` draws them inside the section's grid (each child spans as it
 * needs, with `span`); `read` pulls their values off the submitted form,
 * merged into the values `onSave` receives.
 */
export type ProducerExtra<E extends object> = {
  render: (ctx: {
    /** The form's ID prefix, for element IDs. */
    id: string;
    /** The save's "address" error, or null; `clearError` drops it on change. */
    error: string | null;
    clearError: () => void;
    span: FieldSpans;
  }) => ReactNode;
  read: (data: FormData) => E;
};

/** The words that differ between an agent and the agency. */
export type ProducerLabels = {
  name: string;
  aliases: string;
  aliasesHint: string;
  npn: string;
  licensedHint: string;
};

/** Where the form is drawn; see the file comment. */
export type ProducerFormLayout = "dialog" | "page";

type ProducerFormProps<E extends object> = {
  /** Prefix for element IDs; the `<h2>` is `${id}-title`, which the dialog is labelled by. */
  id: string;
  title: string;
  /** Under the title in the dialog layout; the page layout leaves it out. */
  description: string;
  submitLabel: string;
  labels: ProducerLabels;
  /** Values to start from; leave out for an empty add form. The lines are optional: the agency has none. */
  initial?: Omit<ProducerValues, "licenseLines"> & Partial<Pick<ProducerValues, "licenseLines">> & Partial<E>;
  /** Fields only this producer has; see ProducerExtra. */
  extra?: ProducerExtra<E>;
  /** Show a Life and a Health checkbox beside each checked state's number (agents). */
  lines?: boolean;
  layout?: ProducerFormLayout;
  /**
   * Saves the values; returns (or resolves with) the error to show instead
   * of closing. While a promise is pending the buttons are disabled.
   */
  onSave: (values: ProducerValues & E) => ProducerError | null | Promise<ProducerError | null>;
  close: () => void;
};

/** Input name for one state's licence number. */
const numberField = (code: string) => `licenseNumber-${code}`;

/** Checkbox name for one line of business on one state's licence. */
const lineField = (code: string, line: keyof LicenceLines) => `licenseLine-${code}-${line}`;

const LINES: { key: keyof LicenceLines; label: string }[] = [
  { key: "life", label: "Life" },
  { key: "health", label: "Health" },
];

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

/**
 * Trimmed values out of the submitted form, licence numbers (and lines,
 * when the form shows them) for checked states only.
 */
function readValues(form: HTMLFormElement, lines: boolean): ProducerValues {
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
    // An unticked box has no entry in the form data.
    licenseLines: lines
      ? Object.fromEntries(
          licensedStates.map((code) => [
            code,
            { life: data.has(lineField(code, "life")), health: data.has(lineField(code, "health")) },
          ]),
        )
      : {},
  };
}

const spans = (layout: ProducerFormLayout): FieldSpans =>
  layout === "page"
    ? { full: "sm:col-span-2 xl:col-span-4", field: "", innerGrid: "sm:grid-cols-3 xl:grid-cols-6" }
    : { full: "sm:col-span-2", field: "", innerGrid: "sm:grid-cols-3" };

type FormSectionProps = {
  title: string;
  /** Shown at the right of the title, e.g. the status select. */
  action?: ReactNode;
  layout: ProducerFormLayout;
  /** The grid classes for the fields inside. */
  columns: string;
  children: ReactNode;
};

/** One titled group of fields. A card on the page; in the dialog, a block under a rule. */
function FormSection({ title, action, layout, columns, children }: FormSectionProps) {
  const shell =
    layout === "page"
      ? "rounded-lg border border-line bg-surface p-5 shadow-sm"
      : "border-t border-line pt-5";
  return (
    <section className={`min-w-0 ${shell}`}>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {action}
      </div>
      <div className={`mt-3 grid gap-4 ${columns}`}>{children}</div>
    </section>
  );
}

export function ProducerForm<E extends object = Record<never, never>>({
  id,
  title,
  description,
  submitLabel,
  labels,
  initial,
  extra,
  lines = false,
  layout = "dialog",
  onSave,
  close,
}: ProducerFormProps<E>) {
  const [nameError, setNameError] = useState<string | null>(null);
  const [npnError, setNpnError] = useState<string | null>(null);
  const [numbersError, setNumbersError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Follows the checkboxes, so each checked state gets a licence number input.
  const [licensedCodes, setLicensedCodes] = useState(initial?.licensedStates ?? []);
  const page = layout === "page";
  const span = spans(layout);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const extraValues = extra ? extra.read(new FormData(form)) : ({} as E);
    // The checks a save can't pass without: a number for every checked state.
    const values = { ...readValues(form, lines), ...extraValues };
    const unnumbered = unnumberedStatesError(values);
    if (unnumbered) {
      setNumbersError(unnumbered.message);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const error = await onSave(values);
      if (error) {
        if (error.field === "name") setNameError(error.message);
        else if (error.field === "npn") setNpnError(error.message);
        else if (error.field === "address") setAddressError(error.message);
        else if (error.field === "form") setFormError(error.message);
        else setNumbersError(error.message);
        return;
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  // Status lives in the Identity header, not the grid: it is a setting, not a detail.
  const status = (
    <label htmlFor={`${id}-status`} className="flex items-center gap-2 text-sm text-fg-muted">
      Status
      <select
        id={`${id}-status`}
        name="status"
        defaultValue={initial?.status ?? "active"}
        className={`${TOOLBAR_INPUT_CLASS} py-1 pr-7 text-fg`}
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </label>
  );

  const identity = (
    <FormSection title="Identity" action={status} layout={layout} columns="sm:grid-cols-3">
      <Field
        label={labels.name}
        htmlFor={`${id}-name`}
        hint={nameError ?? undefined}
        hintId={`${id}-name-error`}
        error
      >
        <input
          id={`${id}-name`}
          name="name"
          type="text"
          required
          pattern=".*\S.*"
          autoComplete="off"
          defaultValue={initial?.name}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${id}-name-error` : undefined}
          onChange={() => setNameError(null)}
          className={INPUT_CLASS}
        />
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
      <Field
        label={labels.aliases}
        optional
        htmlFor={`${id}-aliases`}
        hint={labels.aliasesHint}
        hintId={`${id}-aliases-hint`}
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
    </FormSection>
  );

  const contact = (
    <FormSection
      title="Contact"
      layout={layout}
      columns={page ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2"}
    >
      <Field label="Email" htmlFor={`${id}-email`} className={span.field}>
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
      <Field label="Phone" htmlFor={`${id}-phone`} className={span.field}>
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
      {extra?.render({ id, error: addressError, clearError: () => setAddressError(null), span })}
    </FormSection>
  );

  const licences = (
    <FormSection title="Licences" layout={layout} columns={page ? "xl:grid-cols-2" : ""}>
      <StateCheckboxes
        legend="Licensed states"
        name="licensedStates"
        defaultChecked={initial?.licensedStates}
        onChange={(codes) => {
          setLicensedCodes(codes);
          setNumbersError(null);
        }}
        // The page has the room to show more of the list at once.
        gridClassName={page ? "max-h-[24rem] sm:grid-cols-3 2xl:grid-cols-4" : undefined}
        describedBy={`${id}-licensed-hint`}
      >
        <p id={`${id}-licensed-hint`} className="sr-only">
          {labels.licensedHint} Each checked state needs its licence number.
        </p>
      </StateCheckboxes>

      <fieldset className="min-w-0">
        <legend className="text-sm font-medium text-fg">
          Licence numbers
          {licensedCodes.length > 0 ? (
            <span className="font-normal text-fg-subtle"> ({licensedCodes.length})</span>
          ) : null}
        </legend>
        {licensedCodes.length === 0 ? (
          <p className="mt-1 text-xs text-fg-subtle">Check a state and its number goes here.</p>
        ) : (
          // With the line checkboxes a row is wide, so those stay one to a line.
          <div className={`mt-2 grid gap-x-4 gap-y-2 ${lines ? "" : "sm:grid-cols-2"}`}>
            {licensedCodes.map((code) => {
              const stateName = US_STATE_NAMES[code] ?? code;
              return (
                // One row per state: code, the number, then the lines it covers.
                <div key={code} className="flex items-center gap-3 text-sm text-fg">
                  <span
                    className="w-7 shrink-0 font-mono text-xs font-medium text-fg-muted"
                    title={US_STATE_NAMES[code]}
                  >
                    {code}
                  </span>
                  <input
                    name={numberField(code)}
                    type="text"
                    required
                    pattern=".*\S.*"
                    autoComplete="off"
                    placeholder="Licence number"
                    aria-label={`${stateName} licence number`}
                    aria-invalid={numbersError ? true : undefined}
                    aria-describedby={numbersError ? `${id}-numbers-error` : undefined}
                    onChange={() => setNumbersError(null)}
                    defaultValue={initial?.licenseNumbers[code]}
                    className={`${INPUT_CLASS} mt-0! min-w-0 flex-1`}
                  />
                  {lines ? (
                    <div className="flex shrink-0 items-center gap-3" role="group" aria-label={`${stateName} lines`}>
                      {LINES.map((line) => (
                        <label key={line.key} className="flex items-center gap-1.5 text-sm text-fg">
                          <input
                            type="checkbox"
                            name={lineField(code, line.key)}
                            defaultChecked={initial?.licenseLines?.[code]?.[line.key] ?? false}
                            className="size-4 accent-brand-strong"
                          />
                          {line.label}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {numbersError ? (
          <p id={`${id}-numbers-error`} className="mt-1 text-xs text-danger">
            {numbersError}
          </p>
        ) : null}
      </fieldset>
    </FormSection>
  );

  const buttons = (
    <>
      <button type="button" onClick={close} disabled={saving} className={GHOST_BUTTON_CLASS}>
        Cancel
      </button>
      <button type="submit" disabled={saving} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
        {saving ? "Saving…" : submitLabel}
      </button>
    </>
  );

  if (page) {
    return (
      <form onSubmit={handleSubmit}>
        <h2 id={`${id}-title`} className="sr-only">
          {title}
        </h2>

        {/* One card per row, Licences last; capped so the inputs stay a sensible width. */}
        <div className="mx-auto grid max-w-(--breakpoint-2xl) gap-5">
          {identity}
          {contact}
          {licences}
        </div>

        {/*
         * Stuck to the bottom of the viewport, spanning the main area's
         * inset, so the buttons are in reach however tall the form gets.
         */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-(--breakpoint-2xl) flex-wrap items-center justify-between gap-3">
            <div role="alert" className="min-w-0 text-sm text-danger">
              {formError}
            </div>
            <div className="ml-auto flex gap-2">{buttons}</div>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {title}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">{description}</p>

      <div className="mt-5 grid gap-5">
        {identity}
        {contact}
        {licences}
      </div>

      {/* Errors about the attempt itself (no permission, API down), not one field. */}
      <div role="alert" className="mt-4">
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>

      <div className="mt-4 flex justify-end gap-2">{buttons}</div>
    </form>
  );
}
