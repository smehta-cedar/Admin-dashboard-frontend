"use client";

import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  GHOST_BUTTON_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  ROW_BUTTON_CLASS,
  TOOLBAR_INPUT_CLASS,
} from "@/components/classes";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DeleteIcon } from "@/components/delete-icon";
import { EditIcon } from "@/components/edit-icon";
import { Field } from "@/components/field";
import { PROFILE_BUTTON_CLASS } from "@/components/profile-shell";
import { StateSelect } from "@/components/state-select";
import { formatPhone } from "@/lib/phone";
import { formatLicenceDate, type LicenceDates, type LicenceLines } from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * The one producer form, shared by the agent dialog (agents/agent-dialog.tsx),
 * the Add agent page (agents/new) and the agency dialog
 * (agency/agency-dialog.tsx): an agent and the agency are both licensed
 * producers with the same fields — name, aliases, status, NPN, email, phone
 * and their state licences. Only the wording differs, so each dialog passes
 * its `labels`, and the save (saveAgent / saveAgency) stays with the dialog.
 * The agency edits its licences one at a time from its profile's State
 * licences panel instead, so its dialog turns the Licences section off
 * (`licences={false}`).
 *
 * The fields are grouped into three titled sections. It is an internal form
 * for people who know it, so there is no help text, apart from "Separate by
 * comma." under the aliases:
 *
 *   Identity  — name, NPN and aliases on one line; the status select sits
 *               in the section's header, on the right, Active by default
 *   Contact   — email and phone, then the producer's `extra` fields if it
 *               has any (the agent's personal email, phone and address)
 *   Licences  — entered one at a time: a row with a state dropdown, the
 *               licence number, (with `dates`) a start and an end date,
 *               (with `lines`) a Health and a Life checkbox, and an Add
 *               button. Adding puts the licence in the list above the row and
 *               clears the row for the next one. A listed licence can be
 *               taken back into the row (Edit) or removed. The list is
 *               what the form submits; the row itself is never part of it.
 *
 * Two layouts. `dialog` (the default) stacks the sections under the title
 * inside a modal, separated by rules, the fields in two columns. `page` is
 * for a full page: one card per row, capped at the 2xl breakpoint so the
 * inputs never stretch too wide, the fields inside spread over four columns
 * from `xl`. The licence entry is two rows in both: state, number and dates,
 * then the lines and the Add button. On the Add agent
 * page (`licenceEntry="button"`) that row stays hidden until Add licence,
 * and again after a licence is added; Edit opens it for the row being
 * changed. The Cancel and submit buttons sit in a bar stuck to the bottom
 * of the viewport. `pageExtra` is another card after Licences, only drawn
 * in the page layout (the Add agent page's certifications).
 *
 * A required field has a red star after its label (`Field required`); the
 * others carry no "(optional)", the star being the only marking.
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
  /** The Life / Health lines per licensed state; empty without `lines` (the agency). */
  licenseLines: Record<string, LicenceLines>;
  /** The start and end date per licensed state; empty without `dates` (the agency). */
  licenseDates: Record<string, LicenceDates>;
};

/**
 * A save error, shown under the field it names. "licenseNumbers" is the
 * licence list's; "address" is the agent-only section's; "form" is about
 * the attempt itself (no permission, API down) and shows under the form.
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
  /** The one hint on the form, under the aliases. */
  aliasesHint: string;
  npn: string;
};

/** Where the form is drawn; see the file comment. */
export type ProducerFormLayout = "dialog" | "page";

/**
 * Whether the licence entry row is on screen. `open` is the dialogs, where
 * the row is always there. `button` is the Add agent page: the row appears
 * when Add licence is clicked, and hides again once the licence is in the list.
 */
export type LicenceEntryMode = "open" | "button";

/** The licence part of the values, which the initial values may leave out. */
type LicenceMaps = "licensedStates" | "licenseNumbers" | "licenseLines" | "licenseDates";

type ProducerFormProps<E extends object> = {
  /** Prefix for element IDs; the `<h2>` is `${id}-title`, which the dialog is labelled by. */
  id: string;
  title: string;
  /** Under the title in the dialog layout; the page layout leaves it out. */
  description: string;
  submitLabel: string;
  labels: ProducerLabels;
  /** Values to start from; leave out for an empty add form. The licence maps are optional: the agency has no lines or dates, and no licences at all without `licences`. */
  initial?: Omit<ProducerValues, LicenceMaps> & Partial<Pick<ProducerValues, LicenceMaps>> & Partial<E>;
  /** Fields only this producer has; see ProducerExtra. */
  extra?: ProducerExtra<E>;
  /** Show the Licences section. Off, the licence values come back empty (the agency). */
  licences?: boolean;
  /** Ask for the Health and Life lines on each licence (agents). */
  lines?: boolean;
  /** Ask for the start and end date on each licence (agents). */
  dates?: boolean;
  /** See LicenceEntryMode. Defaults to the row always being open. */
  licenceEntry?: LicenceEntryMode;
  /**
   * Extra content after the sections, inside the page layout's grid (the
   * Add agent page's certifications card). Ignored in the dialog layout.
   */
  pageExtra?: ReactNode;
  /**
   * Writes the licence list after a delete, when the producer already exists.
   * Resolves with an error message to keep the row. Omit it when there is
   * nothing on the server yet (Add agent): the row only leaves the list.
   */
  onLicencesChange?: (
    licences: Pick<ProducerValues, "licensedStates" | "licenseNumbers" | "licenseLines" | "licenseDates">,
  ) => Promise<string | null>;
  layout?: ProducerFormLayout;
  /**
   * Saves the values; returns (or resolves with) the error to show instead
   * of closing. While a promise is pending the buttons are disabled.
   */
  onSave: (values: ProducerValues & E) => ProducerError | null | Promise<ProducerError | null>;
  close: () => void;
};

/** One licence as the form lists it, and as the entry row holds it while it is typed. */
type LicenceEntry = {
  state: string;
  licenseNumber: string;
  startDate: string;
  endDate: string;
  life: boolean;
  health: boolean;
};

const EMPTY_ENTRY: LicenceEntry = {
  state: "",
  licenseNumber: "",
  startDate: "",
  endDate: "",
  life: false,
  health: false,
};

/** The line checkboxes, in the order the row shows them. */
const LINES: { key: keyof LicenceLines; label: string }[] = [
  { key: "health", label: "Health" },
  { key: "life", label: "Life" },
];

/** The initial values' licences as list entries, in state-code order. */
function entriesFrom(initial: ProducerFormProps<object>["initial"]): LicenceEntry[] {
  if (!initial?.licensedStates) return [];
  return initial.licensedStates.map((state) => ({
    state,
    licenseNumber: initial.licenseNumbers?.[state] ?? "",
    startDate: initial.licenseDates?.[state]?.startDate ?? "",
    endDate: initial.licenseDates?.[state]?.endDate ?? "",
    life: initial.licenseLines?.[state]?.life ?? false,
    health: initial.licenseLines?.[state]?.health ?? false,
  }));
}

/** "Health & Life", "Health", "Life" or "—", as the list shows an entry's lines. */
const linesText = (entry: LicenceEntry) =>
  LINES.filter((line) => entry[line.key])
    .map((line) => line.label)
    .join(" & ") || "—";

/** The licence maps a list of entries submits, in state-code order. */
function licenceMaps(licences: LicenceEntry[], lines: boolean, dates: boolean) {
  const sorted = licences.slice().sort((a, b) => a.state.localeCompare(b.state));
  return {
    licensedStates: sorted.map((entry) => entry.state),
    licenseNumbers: Object.fromEntries(
      sorted.flatMap((entry) => (entry.licenseNumber ? [[entry.state, entry.licenseNumber]] : [])),
    ),
    licenseLines: lines
      ? Object.fromEntries(sorted.map((entry) => [entry.state, { life: entry.life, health: entry.health }]))
      : {},
    licenseDates: dates
      ? Object.fromEntries(sorted.map((entry) => [entry.state, { startDate: entry.startDate, endDate: entry.endDate }]))
      : {},
  };
}

/**
 * Trimmed values out of the submitted form, plus the licence maps from the
 * list (lines and dates only when the form asks for them).
 */
function readValues(form: HTMLFormElement, licences: LicenceEntry[], lines: boolean, dates: boolean): ProducerValues {
  const data = new FormData(form);
  const text = (field: keyof ProducerValues) => String(data.get(field) ?? "").trim();
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
    ...licenceMaps(licences, lines, dates),
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
  licences = true,
  lines = false,
  dates = false,
  licenceEntry = "open",
  pageExtra,
  onLicencesChange,
  layout = "dialog",
  onSave,
  close,
}: ProducerFormProps<E>) {
  const [nameError, setNameError] = useState<string | null>(null);
  const [npnError, setNpnError] = useState<string | null>(null);
  const [licencesError, setLicencesError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The licences the form will submit, in the order they were added; none when the section is off.
  const [licenceList, setLicenceList] = useState<LicenceEntry[]>(() => (licences ? entriesFrom(initial) : []));
  // The entry row. The key remounts the state dropdown, which is uncontrolled, whenever the row is reset.
  const [draft, setDraft] = useState<LicenceEntry>(EMPTY_ENTRY);
  const [draftKey, setDraftKey] = useState(0);
  const [draftError, setDraftError] = useState<string | null>(null);
  // The Add agent page hides the entry row until Add licence (or Edit). A licence pulled out to edit is held so Cancel can put it back.
  const onRequest = licenceEntry === "button";
  const [entryOpen, setEntryOpen] = useState(!onRequest);
  const [held, setHeld] = useState<LicenceEntry | null>(null);
  /** State code of the licence waiting on the delete confirmation, or null. */
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const page = layout === "page";
  const span = spans(layout);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const extraValues = extra ? extra.read(new FormData(form)) : ({} as E);
    const values = { ...readValues(form, licenceList, lines, dates), ...extraValues };
    setSaving(true);
    setFormError(null);
    try {
      const error = await onSave(values);
      if (error) {
        if (error.field === "name") setNameError(error.message);
        else if (error.field === "npn") setNpnError(error.message);
        else if (error.field === "address") setAddressError(error.message);
        else if (error.field === "form") setFormError(error.message);
        else setLicencesError(error.message);
        return;
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  /** Clears the entry row (and starts it from `next`, for Edit), then puts the cursor back on the state. */
  const resetDraft = (next: LicenceEntry = EMPTY_ENTRY) => {
    setDraft(next);
    setDraftError(null);
    setDraftKey((key) => key + 1);
    requestAnimationFrame(() => document.getElementById(`${id}-licence-state`)?.focus());
  };

  /** Moves the entry row into the list, once it has a state and a number and its dates are in order. */
  const addLicence = () => {
    const entry = { ...draft, licenseNumber: draft.licenseNumber.trim() };
    if (!entry.state) {
      setDraftError("Pick a state.");
      return;
    }
    if (!entry.licenseNumber) {
      setDraftError(`Enter the ${US_STATE_NAMES[entry.state] ?? entry.state} licence number.`);
      return;
    }
    if (entry.startDate && entry.endDate && entry.endDate < entry.startDate) {
      setDraftError("The end date must be on or after the start date.");
      return;
    }
    if (licenceList.some((licence) => licence.state === entry.state)) {
      setDraftError(`${entry.state} is already in the list. Delete it to enter it again.`);
      return;
    }
    setLicenceList((current) => [...current, entry]);
    setLicencesError(null);
    setHeld(null);
    if (onRequest) {
      setEntryOpen(false);
      setDraft(EMPTY_ENTRY);
      setDraftError(null);
      setDraftKey((key) => key + 1);
    } else {
      resetDraft();
    }
  };

  /** Takes a listed licence back into the entry row to change it. */
  const editLicence = (state: string) => {
    const entry = licenceList.find((licence) => licence.state === state);
    if (!entry) return;
    setLicenceList((current) => current.filter((licence) => licence.state !== state));
    if (onRequest) {
      setHeld(entry);
      setEntryOpen(true);
    }
    resetDraft(entry);
  };

  /** Closes the entry row. A licence that was opened to edit goes back on the list. */
  const cancelEntry = () => {
    if (held) {
      setLicenceList((current) => [...current, held]);
      setHeld(null);
    }
    setEntryOpen(false);
    setDraft(EMPTY_ENTRY);
    setDraftError(null);
    setDraftKey((key) => key + 1);
  };

  const openEntry = () => {
    setHeld(null);
    setEntryOpen(true);
    resetDraft();
  };

  const removeLicence = (state: string) => {
    setLicenceList((current) => current.filter((licence) => licence.state !== state));
  };

  // Enter inside the entry row adds the licence instead of saving the whole
  // form. The state dropdown handles its own Enter (a pick) and the Add
  // button clicks itself, so neither is doubled up.
  const addOnEnter = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" || event.defaultPrevented) return;
    if ((event.target as HTMLElement).tagName === "BUTTON") return;
    event.preventDefault();
    addLicence();
  };

  const updateDraft = (patch: Partial<LicenceEntry>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDraftError(null);
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
        required
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
        required
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
      <Field label="Email" required htmlFor={`${id}-email`} className={span.field}>
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
      <Field label="Phone" required htmlFor={`${id}-phone`} className={span.field}>
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

  // Two rows: the licence details, then the lines and the button.
  const entryRow = (
    <div role="group" aria-label="New licence" className="grid gap-3" onKeyDown={addOnEnter}>
      <div className={`grid items-end gap-3 ${dates ? "grid-cols-4" : "grid-cols-2"}`}>
        <Field label="State" required htmlFor={`${id}-licence-state`}>
          <StateSelect
            key={draftKey}
            id={`${id}-licence-state`}
            name={`${id}-licence-state`}
            defaultValue={draft.state}
            onChange={(state) => updateDraft({ state })}
            invalid={Boolean(draftError) && !draft.state}
            describedBy={draftError ? `${id}-licence-error` : undefined}
          />
        </Field>
        <Field label="Licence number" required htmlFor={`${id}-licence-number`}>
          <input
            id={`${id}-licence-number`}
            type="text"
            autoComplete="off"
            value={draft.licenseNumber}
            onChange={(event) => updateDraft({ licenseNumber: event.target.value })}
            aria-invalid={draftError && draft.state && !draft.licenseNumber.trim() ? true : undefined}
            aria-describedby={draftError ? `${id}-licence-error` : undefined}
            className={INPUT_CLASS}
          />
        </Field>
        {dates ? (
          <>
            <Field label="Start date" htmlFor={`${id}-licence-start`}>
              <input
                id={`${id}-licence-start`}
                type="date"
                value={draft.startDate}
                onChange={(event) => updateDraft({ startDate: event.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="End date" htmlFor={`${id}-licence-end`}>
              <input
                id={`${id}-licence-end`}
                type="date"
                min={draft.startDate || undefined}
                value={draft.endDate}
                onChange={(event) => updateDraft({ endDate: event.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
          </>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        {lines ? (
          <div role="group" aria-label="Lines" className="flex items-center gap-4 text-sm text-fg">
            {LINES.map((line) => (
              <label key={line.key} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draft[line.key]}
                  onChange={(event) => updateDraft({ [line.key]: event.target.checked })}
                  className="size-4 accent-brand-strong"
                />
                {line.label}
              </label>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {onRequest ? (
            <button type="button" onClick={cancelEntry} className={GHOST_BUTTON_CLASS}>
              Cancel
            </button>
          ) : null}
          <button type="button" onClick={addLicence} className={`${PRIMARY_BUTTON_CLASS} whitespace-nowrap`}>
            {held ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );

  const licenceTable =
    licenceList.length === 0 ? (
      <p className="text-sm text-fg-subtle">No licences added yet.</p>
    ) : (
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs text-fg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Action
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                State
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Licence number
              </th>
              {dates ? (
                <>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Start date
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    End date
                  </th>
                </>
              ) : null}
              {lines ? (
                <th scope="col" className="px-3 py-2 font-medium">
                  Lines
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {licenceList.map((entry) => (
              <tr key={entry.state} className="text-fg">
                <td className="px-3 py-1 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => editLicence(entry.state)}
                    className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
                  >
                    <EditIcon className="size-3.5 shrink-0" />
                    <span className="sr-only"> {US_STATE_NAMES[entry.state] ?? entry.state}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(entry.state)}
                    aria-label={`Delete the ${US_STATE_NAMES[entry.state] ?? entry.state} licence`}
                    title="Delete"
                    className={`inline-flex items-center ${ROW_BUTTON_CLASS} hover:text-danger`}
                  >
                    <DeleteIcon className="size-3.5 shrink-0" />
                  </button>
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono text-xs font-medium text-fg-muted">{entry.state}</span>{" "}
                  {US_STATE_NAMES[entry.state] ?? ""}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{entry.licenseNumber}</td>
                {dates ? (
                  <>
                    <td className="px-3 py-2 whitespace-nowrap">{entry.startDate ? formatLicenceDate(entry.startDate) : "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{entry.endDate ? formatLicenceDate(entry.endDate) : "—"}</td>
                  </>
                ) : null}
                {lines ? <td className="px-3 py-2">{linesText(entry)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  const licencesSection = (
    <>
    <FormSection
      title="Licences"
      layout={layout}
      columns=""
      action={
        onRequest && !entryOpen ? (
          <button type="button" onClick={openEntry} className={PROFILE_BUTTON_CLASS}>
            <span aria-hidden="true">+ </span>Add licence
          </button>
        ) : null
      }
    >
      {onRequest && !entryOpen && licenceList.length === 0 && !licencesError ? null : (
      <div className="min-w-0">
        <p className="mb-2 text-sm font-medium text-fg">
          Added
          {licenceList.length > 0 ? (
            <span className="font-normal text-fg-subtle"> ({licenceList.length})</span>
          ) : null}
        </p>
        {licenceTable}
        {licencesError ? (
          <p id={`${id}-licences-error`} role="alert" className="mt-1 text-xs text-danger">
            {licencesError}
          </p>
        ) : null}
      </div>
      )}

      {entryOpen ? (
        <div className="min-w-0 mt-7">
          {entryRow}
          {draftError ? (
            <p id={`${id}-licence-error`} role="alert" className="mt-1 text-xs text-danger">
              {draftError}
            </p>
          ) : null}
        </div>
      ) : null}
    </FormSection>
    <ConfirmDialog
      open={pendingDelete !== null}
      title="Delete licence"
      message={
        pendingDelete
          ? `Delete the ${US_STATE_NAMES[pendingDelete] ?? pendingDelete} licence?`
          : ""
      }
      onConfirm={async () => {
        if (!pendingDelete) return;
        // A licence opened for edit is off the list but still saved; keep it.
        const remaining = [...licenceList.filter((entry) => entry.state !== pendingDelete), ...(held ? [held] : [])];
        if (onLicencesChange) {
          const message = await onLicencesChange(licenceMaps(remaining, lines, dates));
          if (message) {
            setLicencesError(message);
            return;
          }
        }
        setLicencesError(null);
        removeLicence(pendingDelete);
      }}
      onClose={() => setPendingDelete(null)}
    />
    </>
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
          {licences ? licencesSection : null}
          {pageExtra}
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
        {licences ? licencesSection : null}
      </div>

      {/* Errors about the attempt itself (no permission, API down), not one field. */}
      <div role="alert" className="mt-4">
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>

      <div className="mt-4 flex justify-end gap-2">{buttons}</div>
    </form>
  );
}
