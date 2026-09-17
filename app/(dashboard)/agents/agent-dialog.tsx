"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { StateCheckboxes } from "@/components/state-checkboxes";
import type { AgentField, AgentNote, AgentRecord } from "@/lib/agents";
import { diffValues, nextId } from "@/lib/change-notes";
import { formatPhone } from "@/lib/phone";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * The one Add / Edit agent dialog: name, aliases, status, NPN, email, phone,
 * licensed states, and the licence number for each state that is checked —
 * required, so a state can't be added to an agent without its number. The
 * Agents page opens it from Add agent and a row's Edit; an agent's profile
 * opens it in edit mode from its own Edit button, so both places edit an agent
 * with exactly the same form and the same checks.
 *
 * Each view owns its agents and notes state and passes `onSave`, which usually
 * calls `saveAgent` below and sets that state. Adds and edits are dummy:
 * nothing reaches a server, and a refresh brings back the JSON.
 */

/** Which dialog is open. Edit holds the agent as it was when the dialog opened. */
export type AgentEditor = { mode: "add" } | { mode: "edit"; agent: AgentRecord };

export type AgentValues = Omit<AgentRecord, "id">;

/** A save error, shown under the field it names. */
export type AgentError = { field: "npn" | "licenseNumbers"; message: string };

/** Also the order changes are compared and listed in. */
export const AGENT_FIELD_LABELS: Record<AgentField, string> = {
  name: "Name",
  aliases: "Aliases",
  status: "Status",
  npn: "NPN",
  email: "Email",
  phone: "Phone",
  licensedStates: "Licensed states",
  licenseNumbers: "Licence numbers",
};

const FIELDS = Object.keys(AGENT_FIELD_LABELS) as AgentField[];

/** Input name for one state's licence number. */
const numberField = (code: string) => `licenseNumber-${code}`;

/** An agent's values as notes compare and show them: licence numbers become "TX 2104587" items. */
const noteValues = (values: AgentValues) => ({
  ...values,
  licenseNumbers: Object.entries(values.licenseNumbers).map(
    ([code, number]) => `${code} ${number}`,
  ),
});

type SaveInput = {
  /** Every agent the NPN must be unique among. Only `id`, `name` and `npn` are read from the others. */
  agents: Pick<AgentRecord, "id" | "name" | "npn">[];
  /** Every agent note, so the new note's ID is unique. */
  notes: AgentNote[];
  values: AgentValues;
  /** The agent being edited; leave out when adding. */
  editing?: AgentRecord;
};

type SaveResult =
  | { error: AgentError; agent: null }
  | {
      error: null;
      /** The agent as saved; on an edit that changed nothing, the record as it was. */
      agent: AgentRecord;
      /** False when an edit changed nothing: no new note. */
      changed: boolean;
      notes: AgentNote[];
    };

/**
 * Adds or edits an agent, pure. Returns the saved agent and the next notes (a
 * note only when something changed), or the error to show: an NPN that already
 * belongs to another agent, or a licensed state with no licence number. The view puts the agent into its own list.
 */
export function saveAgent({ agents, notes, values, editing }: SaveInput): SaveResult {
  const npnOwner = agents.find((agent) => agent.id !== editing?.id && agent.npn === values.npn);
  if (npnOwner) {
    return {
      error: { field: "npn", message: `NPN ${values.npn} already belongs to ${npnOwner.name}.` },
      agent: null,
    };
  }

  // The inputs are required too; this holds for any caller.
  const unnumbered = values.licensedStates.filter((code) => !values.licenseNumbers[code]);
  if (unnumbered.length > 0) {
    return {
      error: {
        field: "licenseNumbers",
        message: `Enter the licence number for ${unnumbered.join(", ")}, or uncheck ${unnumbered.length === 1 ? "it" : "them"}.`,
      },
      agent: null,
    };
  }

  const agentId = editing?.id ?? nextId(agents);
  const saved = { id: agentId, ...values };
  const changes = diffValues(FIELDS, editing ? noteValues(editing) : {}, noteValues(values));
  // Saving an edit with nothing changed just closes, without a note.
  if (changes.length === 0) return { error: null, agent: saved, changed: false, notes };

  return {
    error: null,
    agent: saved,
    changed: true,
    notes: [
      {
        id: nextId(notes),
        agentId,
        kind: editing ? "edited" : "added",
        createdAt: new Date().toISOString(),
        changes,
      },
      ...notes,
    ],
  };
}

type AgentDialogProps = {
  /** Null keeps the dialog closed. */
  editor: AgentEditor | null;
  /** Saves the values; returns the error to show instead of closing. */
  onSave: (values: AgentValues) => AgentError | null;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function AgentDialog({ editor, onSave, onClose }: AgentDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? <AgentForm id={id} editor={editor} onSave={onSave} close={close} /> : null}
    </ModalDialog>
  );
}

type AgentFormProps = Pick<AgentDialogProps, "onSave"> & {
  id: string;
  editor: AgentEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function AgentForm({ id, editor, onSave, close }: AgentFormProps) {
  const editing = editor.mode === "edit" ? editor.agent : undefined;
  const [npnError, setNpnError] = useState<string | null>(null);
  const [numbersError, setNumbersError] = useState<string | null>(null);
  // Follows the checkboxes, so each checked state gets a licence number input.
  const [licensedCodes, setLicensedCodes] = useState(editing?.licensedStates ?? []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (field: AgentField) => String(data.get(field) ?? "").trim();
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
      if (error.field === "npn") setNpnError(error.message);
      else setNumbersError(error.message);
      return;
    }
    close();
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing ? `Edit ${editing.name}` : "Add agent"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {editing
          ? "Saving records a note of what changed. Nothing is saved anywhere yet; refreshing undoes it."
          : "Not saved anywhere yet. The agent stays in the list until you refresh."}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${id}-name`} className="sm:col-span-2">
          <input
            id={`${id}-name`}
            name="name"
            type="text"
            required
            pattern=".*\S.*"
            autoComplete="off"
            defaultValue={editing?.name}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Aliases"
          optional
          htmlFor={`${id}-aliases`}
          hint="Other names on statements, separated by commas."
          hintId={`${id}-aliases-hint`}
          className="sm:col-span-2"
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
        <Field label="Status" htmlFor={`${id}-status`}>
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
        <Field
          label="NPN"
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
            defaultValue={editing?.npn}
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
            defaultValue={editing?.email}
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
            defaultValue={editing?.phone}
            className={INPUT_CLASS}
          />
        </Field>

        <StateCheckboxes
          legend="Licensed states"
          name="licensedStates"
          defaultChecked={editing?.licensedStates}
          onChange={(codes) => {
            setLicensedCodes(codes);
            setNumbersError(null);
          }}
          className="mt-4 sm:col-span-2"
          legendClassName="font-semibold"
          describedBy={`${id}-licensed-hint`}
        >
          <p id={`${id}-licensed-hint`} className="mt-1 text-xs text-fg-subtle">
            Where this agent holds a licence. Each checked state needs its licence number
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
                    defaultValue={editing?.licenseNumbers[code]}
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
          {editing ? "Save changes" : "Add agent"}
        </button>
      </div>
    </form>
  );
}
