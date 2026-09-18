"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { StateCheckboxes } from "@/components/state-checkboxes";
import type { CarrierField, CarrierNote, CarrierRecord } from "@/lib/carriers";
import { diffValues, nextId } from "@/lib/change-notes";
import { LINES_OF_BUSINESS } from "@/lib/lines-of-business";

/*
 * The one Add / Edit carrier dialog: name, aliases, status, lines of business
 * and the states the carrier is available in (the ceiling for every
 * appointment with it). The Carriers page opens it from Add carrier and a row's
 * Edit; the carrier profile opens it from its Edit.
 *
 * Each view owns its carriers and notes state and passes `onSave`, which
 * usually calls `saveCarrier` below and sets that state. Adds and edits are
 * dummy: nothing reaches a server, and a refresh brings back the JSON.
 */

/** Which dialog is open. Edit holds the carrier as it was when the dialog opened. */
export type CarrierEditor = { mode: "add" } | { mode: "edit"; carrier: CarrierRecord };

export type CarrierValues = Omit<CarrierRecord, "id">;

/** A save error, shown under the field it names. Name and lines can both fail at once. */
export type CarrierError = { field: "name" | "linesOfBusiness"; message: string };

/** Also the order changes are compared and listed in. */
export const CARRIER_FIELD_LABELS: Record<CarrierField, string> = {
  name: "Name",
  aliases: "Aliases",
  linesOfBusiness: "Lines of business",
  status: "Status",
  availableStates: "Available states",
};

const FIELDS = Object.keys(CARRIER_FIELD_LABELS) as CarrierField[];

const EMPTY_VALUES = { name: "", aliases: [], linesOfBusiness: [], availableStates: [] };

type SaveInput = {
  carriers: CarrierRecord[];
  notes: CarrierNote[];
  values: CarrierValues;
  /** The carrier being edited; leave out when adding. */
  editing?: CarrierRecord;
};

type SaveResult =
  | { errors: CarrierError[]; carrier: null }
  | {
      errors: [];
      /** The carrier as saved; on an edit that changed nothing, the record as it was. */
      carrier: CarrierRecord;
      /** False when an edit changed nothing: no new carriers or note. */
      changed: boolean;
      carriers: CarrierRecord[];
      notes: CarrierNote[];
    };

/**
 * Adds or edits a carrier, pure. Returns the next carriers and notes (a note
 * only when something changed), or the errors to show: a name another carrier
 * already uses as its name or an alias, and no line of business checked.
 */
export function saveCarrier({ carriers, notes, values, editing }: SaveInput): SaveResult {
  // A name can't repeat another carrier's name or alias (ignoring case).
  const nameKey = values.name.toLowerCase();
  const nameOwner = carriers.find(
    (carrier) =>
      carrier.id !== editing?.id &&
      [carrier.name, ...carrier.aliases].some((name) => name.toLowerCase() === nameKey),
  );
  const errors: CarrierError[] = [];
  if (nameOwner) {
    errors.push({
      field: "name",
      message:
        nameOwner.name.toLowerCase() === nameKey
          ? `${nameOwner.name} is already carrier ${nameOwner.id}.`
          : `${values.name} is already an alias of ${nameOwner.name}.`,
    });
  }
  if (values.linesOfBusiness.length === 0) {
    errors.push({ field: "linesOfBusiness", message: "Choose at least one line of business." });
  }
  if (errors.length > 0) return { errors, carrier: null };

  const carrierId = editing?.id ?? nextId(carriers);
  const saved = { id: carrierId, ...values };
  const changes = diffValues(FIELDS, editing ?? EMPTY_VALUES, values);
  // Saving an edit with nothing changed just closes, without a note.
  if (changes.length === 0) return { errors: [], carrier: saved, changed: false, carriers, notes };

  return {
    errors: [],
    carrier: saved,
    changed: true,
    carriers: editing
      ? carriers.map((carrier) => (carrier.id === carrierId ? saved : carrier))
      : [...carriers, saved],
    notes: [
      {
        id: nextId(notes),
        carrierId,
        kind: editing ? "edited" : "added",
        createdAt: new Date().toISOString(),
        changes,
      },
      ...notes,
    ],
  };
}

type CarrierDialogProps = {
  /** Null keeps the dialog closed. */
  editor: CarrierEditor | null;
  /** Saves the values; returns the errors to show instead of closing. */
  onSave: (values: CarrierValues) => CarrierError[];
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function CarrierDialog({ editor, onSave, onClose }: CarrierDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? (
        <CarrierForm
          id={id}
          editor={editor}
          onSave={onSave}
          close={close}
        />
      ) : null}
    </ModalDialog>
  );
}

type CarrierFormProps = Omit<CarrierDialogProps, "editor" | "onClose"> & {
  id: string;
  editor: CarrierEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function CarrierForm({ id, editor, onSave, close }: CarrierFormProps) {
  const editing = editor.mode === "edit" ? editor.carrier : undefined;
  const [errors, setErrors] = useState<CarrierError[]>([]);

  const messageFor = (field: CarrierError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (field: CarrierError["field"]) =>
    setErrors((current) => current.filter((error) => error.field !== field));

  const nameError = messageFor("name");
  const linesError = messageFor("linesOfBusiness");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (field: CarrierField) => String(data.get(field) ?? "").trim();
    const checkedLines = data.getAll("linesOfBusiness");
    const saveErrors = onSave({
      name: text("name"),
      aliases: text("aliases")
        .split(",")
        .map((alias) => alias.trim())
        .filter(Boolean),
      linesOfBusiness: LINES_OF_BUSINESS.filter((line) => checkedLines.includes(line)),
      status: text("status") === "inactive" ? "inactive" : "active",
      availableStates: [
        ...new Set(data.getAll("availableStates").map((code) => String(code).trim()).filter(Boolean)),
      ].sort(),
    });
    if (saveErrors.length > 0) {
      setErrors(saveErrors);
      return;
    }
    close();
  };

  return (
    <form onSubmit={handleSubmit} className="px-6 py-4">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing ? `Edit ${editing.name}` : "Add carrier"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {editing
          ? "Saving records a note of what changed. Nothing is saved anywhere yet; refreshing undoes it."
          : "Not saved anywhere yet. The carrier stays in the list until you refresh."}
      </p>

      {/* Name and aliases full width; status (left) and lines of business (right) share a row; states below. */}
      <div className="mt-5 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <Field
          label="Name"
          htmlFor={`${id}-name`}
          hint={nameError ?? undefined}
          hintId={`${id}-name-error`}
          error
          className="sm:col-span-2"
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
          optional
          htmlFor={`${id}-aliases`}
          hint="Separate with commas."
          hintId={`${id}-aliases-hint`}
          className="sm:col-span-2 mt-2"
        >
          <input
            id={`${id}-aliases`}
            name="aliases"
            type="text"
            autoComplete="off"
            aria-describedby={`${id}-aliases-hint`}
            defaultValue={editing?.aliases.join(", ")}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Status" htmlFor={`${id}-status`} className="sm:w-40 mt-4 [&>label]:font-semibold">
          <select
            id={`${id}-status`}
            name="status"
            defaultValue={editing?.status ?? "active"}
            className={INPUT_CLASS}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <fieldset className="mt-4 min-w-0">
          <legend className="block text-sm font-semibold text-fg">Lines of business</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {LINES_OF_BUSINESS.map((line) => (
              <label key={line} className="flex items-center gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  name="linesOfBusiness"
                  value={line}
                  defaultChecked={editing?.linesOfBusiness.includes(line)}
                  aria-invalid={linesError ? true : undefined}
                  aria-describedby={linesError ? `${id}-lines-error` : undefined}
                  onChange={() => clear("linesOfBusiness")}
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

        <StateCheckboxes
          legend="Available states"
          name="availableStates"
          defaultChecked={editing?.availableStates}
          className="sm:col-span-2 mt-4"
          legendClassName="font-semibold"
        />
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={close} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" className={PRIMARY_BUTTON_CLASS}>
          {editing ? "Save changes" : "Add carrier"}
        </button>
      </div>
    </form>
  );
}
