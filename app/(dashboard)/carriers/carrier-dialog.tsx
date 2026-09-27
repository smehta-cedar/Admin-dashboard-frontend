"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { StateCheckboxes } from "@/components/state-checkboxes";
import type { CarrierError, CarrierField, CarrierRecord, CarrierValues } from "@/lib/carriers";
import { LINES_OF_BUSINESS } from "@/lib/lines-of-business";

/*
 * The one Add / Edit carrier dialog: name, aliases, status, lines of business
 * and the states the carrier is available in (the ceiling for every
 * appointment with it). The Carriers page opens it from Add carrier and a row's
 * Edit; the carrier profile opens it from its Edit.
 *
 * Each view passes `onSave`, which calls the saveCarrier server action
 * (./actions.ts) and updates its own state from the saved record. The API
 * checks the name against every other carrier's name and aliases and records
 * the change note; the form only checks what it can see at once (a line of
 * business is chosen). While the save is in flight the buttons are disabled.
 */

/** Which dialog is open. Edit holds the carrier as it was when the dialog opened. */
export type CarrierEditor = { mode: "add" } | { mode: "edit"; carrier: CarrierRecord };

export type { CarrierError, CarrierValues } from "@/lib/carriers";

/** Also the order changes are listed in on a note. */
export const CARRIER_FIELD_LABELS: Record<CarrierField, string> = {
  name: "Name",
  aliases: "Aliases",
  linesOfBusiness: "Lines of business",
  status: "Status",
  availableStates: "Available states",
};

/** The form's values, read off the submitted FormData. */
export function readCarrierForm(data: FormData): CarrierValues {
  const text = (field: CarrierField) => String(data.get(field) ?? "").trim();
  const checkedLines = data.getAll("linesOfBusiness");
  return {
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
  };
}

type CarrierDialogProps = {
  /** Null keeps the dialog closed. */
  editor: CarrierEditor | null;
  /** Saves the values; resolves with the errors to show instead of closing. */
  onSave: (values: CarrierValues) => Promise<CarrierError[]>;
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
  const [saving, setSaving] = useState(false);

  const messageFor = (field: CarrierError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (field: CarrierError["field"]) =>
    setErrors((current) => current.filter((error) => error.field !== field));

  const nameError = messageFor("name");
  const aliasesError = messageFor("aliases");
  const linesError = messageFor("linesOfBusiness");
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
      const saveErrors = await onSave(values);
      if (saveErrors.length > 0) {
        setErrors(saveErrors);
        return;
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="px-6 py-4">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing ? `Edit ${editing.name}` : "Add carrier"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {editing
          ? "Saving records a note of what changed on the carrier's profile."
          : "The carrier is added for everyone, with a note of what was entered."}
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
          hint={aliasesError ?? "Separate with commas."}
          hintId={`${id}-aliases-hint`}
          error={aliasesError !== null}
          className="sm:col-span-2 mt-2"
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
          onChange={() => clear("availableStates")}
          className="sm:col-span-2 mt-4"
          legendClassName="font-semibold"
          describedBy={statesError ? `${id}-states-error` : undefined}
          footer={
            statesError ? (
              <p id={`${id}-states-error`} className="mt-1 text-xs text-danger">
                {statesError}
              </p>
            ) : null
          }
        />
      </div>

      {/* Errors about the attempt itself (no permission, API down), not one field. */}
      <div role="alert" className="mt-4">
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={close} disabled={saving} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add carrier"}
        </button>
      </div>
    </form>
  );
}
