"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  GHOST_BUTTON_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  ROW_BUTTON_CLASS,
  TOOLBAR_INPUT_CLASS,
} from "@/components/classes";
import { DeleteIcon } from "@/components/delete-icon";
import { EditIcon } from "@/components/edit-icon";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { FormSection } from "@/components/producer-form";
import { PROFILE_BUTTON_CLASS } from "@/components/profile-shell";
import { StateSelect } from "@/components/state-select";
import { StatusBadge, statusLabel } from "@/components/status-badge";
import { CARRIER_STATUSES, type CarrierStatus } from "@/lib/carrier-statuses";
import type {
  CarrierError,
  CarrierField,
  CarrierLicenseValues,
  CarrierRecord,
  CarrierValues,
} from "@/lib/carriers";
import { LINES_OF_BUSINESS, type LineOfBusiness } from "@/lib/lines-of-business";
import {
  AGENCY_LICENCE_STATUSES,
  formatLicenceDate,
  licenceLinesText,
  type StateLicenseStatus,
} from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";
import { saveCarrier } from "./actions";

/*
 * Add carrier (/carriers/new) and Edit carrier (/carriers/[id]/edit), as a
 * page in the same layout as the agent pages: one card per group (Identity
 * with the status select in its header, then Available states, the ceiling
 * for every appointment with the carrier) and a sticky button bar. States
 * are added one at a time like an agent's licences, each with its licence #,
 * start and expiration dates, status and Life / Health lines; the Added list
 * is what submits.
 * Cancel
 * and a successful save both return to `returnTo`, the list or the profile,
 * whichever opened the page.
 *
 * Saves go through the saveCarrier server action (./actions.ts), which
 * revalidates every page, so the list and profile show the change when the
 * page returns to them. The API checks the name against every other
 * carrier's name and aliases and records the change note; the form only
 * checks what it can see at once (a line of business is chosen). Under
 * those lines, Certifications marks which of them need an agent
 * certification. A box there stays off unless that line is checked above.
 */

export type { CarrierError, CarrierValues } from "@/lib/carriers";

/** Also the order changes are listed in on a note. */
export const CARRIER_FIELD_LABELS: Record<CarrierField, string> = {
  name: "Name",
  aliases: "Aliases",
  linesOfBusiness: "Lines of business",
  certificationLines: "Certifications",
  link: "Link",
  status: "Status",
  availableStates: "Available states",
  licenseNumbers: "Licence numbers",
  licenseStatuses: "State statuses",
  licenseLines: "State lines",
  licenseDates: "State dates",
};

/** The form's values, read off the submitted FormData. */
export function readCarrierForm(data: FormData): CarrierValues {
  const text = (field: CarrierField) => String(data.get(field) ?? "").trim();
  const checkedLines = data.getAll("linesOfBusiness");
  const checkedCertifications = data.getAll("certificationLines");
  const linesOfBusiness = LINES_OF_BUSINESS.filter((line) => checkedLines.includes(line));
  return {
    name: text("name"),
    aliases: text("aliases")
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean),
    linesOfBusiness,
    certificationLines: LINES_OF_BUSINESS.filter(
      (line) => linesOfBusiness.includes(line) && checkedCertifications.includes(line),
    ),
    link: text("link"),
    status: CARRIER_STATUSES.find((status) => status === text("status")) ?? ("active" satisfies CarrierStatus),
    licenses: JSON.parse(String(data.get("licenses") ?? "[]")) as CarrierLicenseValues[],
  };
}

type CarrierFormPageProps = {
  /** Set on Edit. Leave out for an empty Add form. */
  carrier?: CarrierRecord;
  /** Where Cancel and a successful save go. */
  returnTo: string;
};

export function CarrierFormPage({ carrier: editing, returnTo }: CarrierFormPageProps) {
  const router = useRouter();
  const id = useId();
  const [errors, setErrors] = useState<CarrierError[]>([]);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<LineOfBusiness[]>(editing?.linesOfBusiness ?? []);
  const [certificationLines, setCertificationLines] = useState<LineOfBusiness[]>(editing?.certificationLines ?? []);

  const messageFor = (field: CarrierError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (field: CarrierError["field"]) =>
    setErrors((current) => current.filter((error) => error.field !== field));

  const nameError = messageFor("name");
  const aliasesError = messageFor("aliases");
  const linkError = messageFor("link");
  const linesError = messageFor("linesOfBusiness");
  const certificationsError = messageFor("certificationLines");
  const statesError = messageFor("availableStates");
  const formError = messageFor("form") ?? messageFor("status");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const values = readCarrierForm(new FormData(event.currentTarget));
    if (values.linesOfBusiness.length === 0) {
      setErrors([{ field: "linesOfBusiness", message: "Choose at least one line of business." }]);
      return;
    }
    setSaving(true);
    try {
      const result = await saveCarrier(values, editing?.id);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      router.push(returnTo);
    } finally {
      setSaving(false);
    }
  };

  const title = editing ? `Edit ${editing.name}` : "Add carrier";

  // Status lives in the Identity header, not the grid: it is a setting, not a detail.
  const status = (
    <label htmlFor={`${id}-status`} className="flex items-center gap-2 text-sm text-fg-muted">
      Status
      <select
        id={`${id}-status`}
        name="status"
        defaultValue={editing?.status ?? "active"}
        className={`${TOOLBAR_INPUT_CLASS} py-1 pr-7 text-fg`}
      >
        {CARRIER_STATUSES.map((option) => (
          <option key={option} value={option}>
            {statusLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <PageHeader title={title} />
      <form onSubmit={handleSubmit}>
        <h2 id={`${id}-title`} className="sr-only">
          {title}
        </h2>

        {/* One card per row; capped so the inputs stay a sensible width. */}
        <div className="mx-auto grid max-w-(--breakpoint-2xl) gap-5">
          <FormSection title="Identity" action={status} layout="page" columns="sm:grid-cols-2">
            <Field
              label="Name"
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
                defaultValue={editing?.name}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? `${id}-name-error` : undefined}
                onChange={() => clear("name")}
                className={INPUT_CLASS}
              />
            </Field>
            <Field
              label="Aliases"
              htmlFor={`${id}-aliases`}
              hint={aliasesError ?? "Separate by comma."}
              hintId={`${id}-aliases-hint`}
              error={aliasesError !== null}
            >
              <input
                id={`${id}-aliases`}
                name="aliases"
                type="text"
                autoComplete="off"
                aria-invalid={aliasesError ? true : undefined}
                aria-describedby={`${id}-aliases-hint`}
                defaultValue={editing?.aliases.join(", ")}
                onChange={() => clear("aliases")}
                className={INPUT_CLASS}
              />
            </Field>
            <div className="min-w-0 sm:col-span-2">
              <fieldset>
                <legend className="block text-sm font-medium text-fg">Lines of business</legend>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                  {LINES_OF_BUSINESS.map((line) => (
                    <label key={line} className="flex items-center gap-2 text-xs text-fg">
                      <input
                        type="checkbox"
                        name="linesOfBusiness"
                        value={line}
                        checked={lines.includes(line)}
                        aria-invalid={linesError ? true : undefined}
                        aria-describedby={linesError ? `${id}-lines-error` : undefined}
                        onChange={(event) => {
                          const on = event.target.checked;
                          setLines((current) =>
                            on
                              ? LINES_OF_BUSINESS.filter((item) => current.includes(item) || item === line)
                              : current.filter((item) => item !== line),
                          );
                          if (!on) setCertificationLines((current) => current.filter((item) => item !== line));
                          clear("linesOfBusiness");
                        }}
                        className="size-4 accent-brand-strong"
                      />
                      {line}
                    </label>
                  ))}
                </div>
                {linesError ? (
                  <p id={`${id}-lines-error`} className="mt-1 text-xs text-danger">
                    {linesError}
                  </p>
                ) : null}
              </fieldset>
              <fieldset className="mt-4">
                <legend className="block text-sm font-bold text-fg">Certifications</legend>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                  {LINES_OF_BUSINESS.map((line) => {
                    const offered = lines.includes(line);
                    return (
                      <label
                        key={line}
                        className={`flex items-center gap-2 text-xs ${offered ? "text-fg" : "text-fg-subtle"}`}
                      >
                        <input
                          type="checkbox"
                          name="certificationLines"
                          value={line}
                          checked={offered && certificationLines.includes(line)}
                          disabled={!offered}
                          aria-invalid={certificationsError ? true : undefined}
                          aria-describedby={
                            certificationsError ? `${id}-certifications-error` : `${id}-certifications-hint`
                          }
                          onChange={(event) => {
                            const on = event.target.checked;
                            setCertificationLines((current) =>
                              on
                                ? LINES_OF_BUSINESS.filter((item) => current.includes(item) || item === line)
                                : current.filter((item) => item !== line),
                            );
                            clear("certificationLines");
                          }}
                          className="size-4 accent-brand-strong disabled:opacity-40"
                        />
                        {line}
                      </label>
                    );
                  })}
                </div>
                {certificationsError ? (
                  <p id={`${id}-certifications-error`} className="mt-1 text-xs text-danger">
                    {certificationsError}
                  </p>
                ) : null}
              </fieldset>
            </div>
            <Field
              label="Link"
              htmlFor={`${id}-link`}
              hint={linkError ?? undefined}
              hintId={`${id}-link-error`}
              error
            >
              <input
                id={`${id}-link`}
                name="link"
                type="url"
                autoComplete="off"
                defaultValue={editing?.link}
                aria-invalid={linkError ? true : undefined}
                aria-describedby={linkError ? `${id}-link-error` : undefined}
                onChange={() => clear("link")}
                className={INPUT_CLASS}
              />
            </Field>

          </FormSection>

          <AvailableStates
            id={id}
            initial={(editing?.licenses ?? []).map(({ id: _id, ...row }) => row)}
            error={statesError}
            onChange={() => clear("availableStates")}
          />
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
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => router.push(returnTo)}
                disabled={saving}
                className={GHOST_BUTTON_CLASS}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add carrier"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}


type AvailableStatesProps = {
  /** Prefix for element IDs. */
  id: string;
  initial: CarrierLicenseValues[];
  /** The API's error for the states, shown under the list. */
  error: string | null;
  /** Runs when the list changes, to clear that error. */
  onChange: () => void;
};

const EMPTY_ROW: CarrierLicenseValues = {
  state: "",
  licenseNumber: "",
  status: "active",
  startDate: "",
  endDate: "",
  life: false,
  health: false,
};

const LINES = [
  { key: "life", label: "Life" },
  { key: "health", label: "Health" },
] as const;

/**
 * The Available states card, in the agent licence design: the Added table,
 * then an entry row (state, licence #, start and expiration dates, status,
 * Life / Health, Cancel, Add) that "+ Add state" opens. Edit pulls a row back
 * into the entry row; Cancel puts it back unchanged. The list submits as one
 * `licenses` hidden input (JSON). Nothing is saved until the form is, so
 * Delete needs no confirmation.
 */
function AvailableStates({ id, initial, error, onChange }: AvailableStatesProps) {
  const [rows, setRows] = useState(initial);
  const [entryOpen, setEntryOpen] = useState(false);
  // The key remounts the state dropdown, which is uncontrolled, whenever the row is reset.
  const [draft, setDraft] = useState(EMPTY_ROW);
  const [draftKey, setDraftKey] = useState(0);
  const [draftError, setDraftError] = useState<string | null>(null);
  // A row pulled out to edit, held so Cancel can put it back.
  const [held, setHeld] = useState<CarrierLicenseValues | null>(null);

  const focusState = () => requestAnimationFrame(() => document.getElementById(`${id}-state-entry`)?.focus());

  const startEntry = (next: CarrierLicenseValues) => {
    setDraft(next);
    setDraftError(null);
    setDraftKey((key) => key + 1);
    setEntryOpen(true);
    focusState();
  };

  const closeEntry = () => {
    setEntryOpen(false);
    setDraft(EMPTY_ROW);
    setDraftError(null);
    setDraftKey((key) => key + 1);
  };

  const cancelEntry = () => {
    if (held) setRows((current) => [...current, held]);
    setHeld(null);
    closeEntry();
  };

  const updateDraft = (patch: Partial<CarrierLicenseValues>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDraftError(null);
  };

  const addRow = () => {
    const row = { ...draft, licenseNumber: draft.licenseNumber.trim() };
    if (!row.state) {
      setDraftError("Pick a state.");
      return;
    }
    if (row.startDate && row.endDate && row.endDate < row.startDate) {
      setDraftError("The expiration date must be on or after the start date.");
      return;
    }
    if (rows.some((current) => current.state === row.state)) {
      setDraftError(`${row.state} is already in the list. Delete it to enter it again.`);
      return;
    }
    setRows((current) => [...current, row]);
    setHeld(null);
    onChange();
    closeEntry();
  };

  const editRow = (state: string) => {
    const row = rows.find((current) => current.state === state);
    if (!row) return;
    // Editing another row while one is held puts the held one back first.
    setRows((current) => [...current.filter((other) => other.state !== state), ...(held ? [held] : [])]);
    setHeld(row);
    startEntry(row);
  };

  const removeRow = (state: string) => {
    setRows((current) => current.filter((row) => row.state !== state));
    onChange();
  };

  // Enter inside the entry row adds the state instead of saving the whole
  // form. The state dropdown handles its own Enter (a pick) and the buttons
  // click themselves, so neither is doubled up.
  const addOnEnter = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" || event.defaultPrevented) return;
    if ((event.target as HTMLElement).tagName === "BUTTON") return;
    event.preventDefault();
    addRow();
  };

  // A held row is still part of the carrier until it is updated or deleted.
  const submitted = held ? [...rows, held] : rows;
  const stateName = (code: string) => US_STATE_NAMES[code] ?? code;

  return (
    <FormSection
      title="Available states"
      layout="page"
      columns=""
      action={
        entryOpen ? null : (
          <button type="button" onClick={() => startEntry(EMPTY_ROW)} className={PROFILE_BUTTON_CLASS}>
            <span aria-hidden="true">+ </span>Add state
          </button>
        )
      }
    >
      <input type="hidden" name="licenses" value={JSON.stringify(submitted)} />

      {!entryOpen && rows.length === 0 && !error ? null : (
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-fg">
            Added
            {rows.length > 0 ? <span className="font-normal text-fg-subtle"> ({rows.length})</span> : null}
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-fg-subtle">No states added yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-hover text-xs text-fg-muted">
                  <tr>
                    {["Action", "State", "Licence #", "Start date", "Expiration date", "Status", "Lines"].map(
                      (column) => (
                        <th key={column} scope="col" className="px-3 py-2 font-medium">
                          {column}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row) => (
                    <tr key={row.state} className="text-fg">
                      <td className="px-3 py-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => editRow(row.state)}
                          aria-label={`Edit ${stateName(row.state)}`}
                          title="Edit"
                          className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
                        >
                          <EditIcon className="size-3.5 shrink-0" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(row.state)}
                          aria-label={`Delete ${stateName(row.state)}`}
                          title="Delete"
                          className={`inline-flex items-center ${ROW_BUTTON_CLASS} hover:text-danger`}
                        >
                          <DeleteIcon className="size-3.5 shrink-0" />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-medium text-fg-muted">{row.state}</span>{" "}
                        {US_STATE_NAMES[row.state] ?? ""}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.licenseNumber || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.startDate ? formatLicenceDate(row.startDate) : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.endDate ? formatLicenceDate(row.endDate) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2">{licenceLinesText(row) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {error ? (
            <p role="alert" className="mt-1 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      )}

      {entryOpen ? (
        <div className="mt-7 min-w-0">
          {/* Two rows: the state's details, then the status, lines and the buttons. */}
          <div role="group" aria-label="New state" className="grid gap-3" onKeyDown={addOnEnter}>
            <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="State" required htmlFor={`${id}-state-entry`}>
                <StateSelect
                  key={draftKey}
                  id={`${id}-state-entry`}
                  name={`${id}-state-entry`}
                  defaultValue={draft.state}
                  onChange={(state) => updateDraft({ state })}
                  invalid={Boolean(draftError) && !draft.state}
                  describedBy={draftError ? `${id}-state-entry-error` : undefined}
                />
              </Field>
              <Field label="Licence #" htmlFor={`${id}-state-number`}>
                <input
                  id={`${id}-state-number`}
                  type="text"
                  autoComplete="off"
                  value={draft.licenseNumber}
                  onChange={(event) => updateDraft({ licenseNumber: event.target.value })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Start date" htmlFor={`${id}-state-start`}>
                <input
                  id={`${id}-state-start`}
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => updateDraft({ startDate: event.target.value })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Expiration date" htmlFor={`${id}-state-end`}>
                <input
                  id={`${id}-state-end`}
                  type="date"
                  min={draft.startDate || undefined}
                  value={draft.endDate}
                  onChange={(event) => updateDraft({ endDate: event.target.value })}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-5 text-sm text-fg">
                <label htmlFor={`${id}-state-status`} className="flex items-center gap-2 text-fg-muted">
                  Status
                  <select
                    id={`${id}-state-status`}
                    value={draft.status}
                    onChange={(event) => updateDraft({ status: event.target.value as StateLicenseStatus })}
                    className={`${TOOLBAR_INPUT_CLASS} py-1 pr-7 text-fg`}
                  >
                    {AGENCY_LICENCE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <div role="group" aria-label="Lines" className="flex items-center gap-4">
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
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={cancelEntry} className={GHOST_BUTTON_CLASS}>
                  Cancel
                </button>
                <button type="button" onClick={addRow} className={`${PRIMARY_BUTTON_CLASS} whitespace-nowrap`}>
                  {held ? "Update" : "Add"}
                </button>
              </div>
            </div>
          </div>
          {draftError ? (
            <p id={`${id}-state-entry-error`} role="alert" className="mt-1 text-xs text-danger">
              {draftError}
            </p>
          ) : null}
        </div>
      ) : null}
    </FormSection>
  );
}
