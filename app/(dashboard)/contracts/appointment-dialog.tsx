"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { StateCheckboxes } from "@/components/state-checkboxes";
import type { AgentRecord } from "@/lib/agents";
import type {
  CarrierContractField,
  CarrierContractNote,
  CarrierContractRecord,
} from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import { diffValues, nextId } from "@/lib/change-notes";

/*
 * The one Add / Edit contract dialog, shared by Contracts by carrier and
 * Contracts by state so every entry point (Add contract, a card's add-agent
 * icon, Add carrier, Edit, a state panel line) opens the same form: agent,
 * carrier and a state checkbox grid. Add starts empty or with an agent or
 * carrier picked; Edit starts filled in from the contract. Both check one
 * contract per agent per carrier and record a note of what changed.
 *
 * The state grid offers only the chosen carrier's availableStates (set on
 * Carriers), and saveAppointment rejects any other state. Editing a contract
 * whose states fall outside that ceiling warns, then saving strips them.
 *
 * Each view owns its contracts and notes state and passes `onSave`, which
 * usually calls `saveAppointment` below and sets that state.
 */

type AgentOption = Pick<AgentRecord, "id" | "name">;
type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status" | "availableStates">;

/** Which dialog is open. Add may start on an agent or carrier; edit holds the contract as it was. */
export type AppointmentEditor =
  | { mode: "add"; agentId?: string; carrierId?: string }
  | { mode: "edit"; contract: CarrierContractRecord };

export type AppointmentValues = Omit<CarrierContractRecord, "id">;

/** A save error, shown under the field it names. */
export type AppointmentError = { field: "agentId" | "appointedStates"; message: string };

/** Also the order changes are compared and listed in. */
export const APPOINTMENT_FIELD_LABELS: Record<CarrierContractField, string> = {
  agentId: "Agent",
  carrierId: "Carrier",
  appointedStates: "States",
};

const FIELDS = Object.keys(APPOINTMENT_FIELD_LABELS) as CarrierContractField[];

const EMPTY_VALUES = { agentId: "", carrierId: "", appointedStates: [] };

/** Unique codes in code order, so a list's order never shows up as a change. */
export const normalizeStates = (codes: string[]) => [...new Set(codes)].sort();

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

type SaveInput = {
  contracts: CarrierContractRecord[];
  notes: CarrierContractNote[];
  values: AppointmentValues;
  /** The contract being edited; leave out when adding. */
  editing?: CarrierContractRecord;
  agentName: (agentId: string) => string;
  carrierName: (carrierId: string) => string;
  /** The carrier's availableStates: the ceiling for appointedStates. */
  availableStates: (carrierId: string) => string[];
};

type SaveResult =
  | { error: AppointmentError }
  | {
      error: null;
      /** False when an edit changed nothing: no new contracts or note. */
      changed: boolean;
      contracts: CarrierContractRecord[];
      notes: CarrierContractNote[];
    };

/**
 * Adds or edits a contract, pure. Returns the next contracts and notes (a note
 * only when something changed), or an error when the agent already has a
 * contract with that carrier or a state is outside the carrier's availableStates.
 */
export function saveAppointment({
  contracts,
  notes,
  values,
  editing,
  agentName,
  carrierName,
  availableStates,
}: SaveInput): SaveResult {
  const duplicate = contracts.some(
    (contract) =>
      contract.id !== editing?.id &&
      contract.agentId === values.agentId &&
      contract.carrierId === values.carrierId,
  );
  if (duplicate) {
    return {
      error: {
        field: "agentId",
        message: `${agentName(values.agentId)} already has a contract with ${carrierName(values.carrierId)}.`,
      },
    };
  }

  const ceiling = availableStates(values.carrierId);
  const outside = normalizeStates(values.appointedStates).filter((code) => !ceiling.includes(code));
  if (outside.length > 0) {
    return {
      error: {
        field: "appointedStates",
        message: `${carrierName(values.carrierId)} isn't available in ${outside.join(", ")}. Add ${
          outside.length === 1 ? "it" : "them"
        } to the carrier's states on Carriers first.`,
      },
    };
  }

  // Values as notes show them: agent and carrier by name, states in code order.
  const shown = (from: AppointmentValues) => ({
    agentId: agentName(from.agentId),
    carrierId: carrierName(from.carrierId),
    appointedStates: normalizeStates(from.appointedStates),
  });
  const changes = diffValues(FIELDS, editing ? shown(editing) : EMPTY_VALUES, shown(values));
  if (changes.length === 0) return { error: null, changed: false, contracts, notes };

  const contractId = editing?.id ?? nextId(contracts);
  const saved = { id: contractId, ...values, appointedStates: normalizeStates(values.appointedStates) };
  return {
    error: null,
    changed: true,
    contracts: editing
      ? contracts.map((contract) => (contract.id === contractId ? saved : contract))
      : [...contracts, saved],
    notes: [
      {
        id: nextId(notes),
        contractId,
        kind: editing ? "edited" : "added",
        createdAt: new Date().toISOString(),
        changes,
      },
      ...notes,
    ],
  };
}

type AppointmentDialogProps = {
  /** Null keeps the dialog closed. */
  editor: AppointmentEditor | null;
  /** Active agents. */
  agents: AgentOption[];
  carriers: CarrierOption[];
  /** Saves the values; returns an error to show instead of closing. */
  onSave: (values: AppointmentValues, editing?: CarrierContractRecord) => AppointmentError | null;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function AppointmentDialog({ editor, agents, carriers, onSave, onClose }: AppointmentDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? (
        <AppointmentForm
          id={id}
          editor={editor}
          agents={agents}
          carriers={carriers}
          onSave={onSave}
          close={close}
        />
      ) : null}
    </ModalDialog>
  );
}

type AppointmentFormProps = Omit<AppointmentDialogProps, "editor" | "onClose"> & {
  id: string;
  editor: AppointmentEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its state starts fresh each time. */
function AppointmentForm({ id, editor, agents, carriers, onSave, close }: AppointmentFormProps) {
  const editing = editor.mode === "edit" ? editor.contract : undefined;
  const [error, setError] = useState<AppointmentError | null>(null);
  // Controlled so the state grid follows the chosen carrier.
  const [carrierId, setCarrierId] = useState(
    editing?.carrierId ?? (editor.mode === "add" ? editor.carrierId : undefined) ?? "",
  );

  const agentName = (agentId: string) =>
    agents.find((agent) => agent.id === agentId)?.name ?? `Agent ${agentId}`;
  const carrierName = (otherId: string) =>
    carriers.find((option) => option.id === otherId)?.name ?? `Carrier ${otherId}`;

  const carrier = carriers.find((option) => option.id === carrierId);
  const ceiling = carrier?.availableStates ?? [];
  // States the contract had that the chosen carrier doesn't offer; saving drops them.
  const stripped = carrier
    ? normalizeStates(editing?.appointedStates ?? []).filter((code) => !ceiling.includes(code))
    : [];

  const agentError = error?.field === "agentId" ? error.message : null;
  const statesError = error?.field === "appointedStates" ? error.message : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (field: CarrierContractField) => String(data.get(field) ?? "").trim();
    const saveError = onSave(
      {
        agentId: text("agentId"),
        carrierId: text("carrierId"),
        appointedStates: normalizeStates(
          data.getAll("appointedStates").map((code) => String(code).trim()).filter(Boolean),
        ),
      },
      editing,
    );
    if (saveError) {
      setError(saveError);
      return;
    }
    close();
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing
          ? `Edit ${agentName(editing.agentId)} at ${carrierName(editing.carrierId)}`
          : "Add contract"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {editing
          ? "Saving records a note of what changed. Nothing is saved anywhere yet; refreshing undoes it."
          : "Not saved anywhere yet. The contract stays on the page until you refresh."}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          label="Agent"
          htmlFor={`${id}-agent`}
          hint={agentError ?? undefined}
          hintId={`${id}-agent-error`}
          error
        >
          <select
            id={`${id}-agent`}
            name="agentId"
            required
            defaultValue={editing?.agentId ?? (editor.mode === "add" ? editor.agentId : undefined) ?? ""}
            aria-invalid={agentError ? true : undefined}
            aria-describedby={agentError ? `${id}-agent-error` : undefined}
            onChange={() => setError(null)}
            className={INPUT_CLASS}
          >
            <option value="">Choose an agent</option>
            {[...agents].sort(byName).map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Carrier" htmlFor={`${id}-carrier`}>
          <select
            id={`${id}-carrier`}
            name="carrierId"
            required
            value={carrierId}
            onChange={(event) => {
              setCarrierId(event.target.value);
              setError(null);
            }}
            className={INPUT_CLASS}
          >
            <option value="">Choose a carrier</option>
            {[...carriers].sort(byName).map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.status === "inactive" ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <StateCheckboxes
          legend="States"
          name="appointedStates"
          codes={ceiling}
          defaultChecked={editing?.appointedStates}
          onChange={() => setError(null)}
          className="sm:col-span-2"
          describedBy={`${id}-states-hint${statesError ? ` ${id}-states-error` : ""}`}
          footer={
            <>
              {stripped.length > 0 ? (
                <p className="mt-2 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn-ink">
                  Saving removes {stripped.join(", ")}: {carrier?.name} isn&apos;t available there.
                </p>
              ) : null}
              {statesError ? (
                <p id={`${id}-states-error`} className="mt-1 text-xs text-danger">
                  {statesError}
                </p>
              ) : null}
            </>
          }
        >
          <p id={`${id}-states-hint`} className="mt-1 text-xs text-fg-subtle">
            {!carrier
              ? "Choose a carrier to see the states it's available in."
              : ceiling.length === 0
                ? `${carrier.name} isn't available in any states yet. Add its states on Carriers before appointing agents there.`
                : `Only ${carrier.name}'s available states are listed. Leave all unchecked if none yet; that means no states, not every state.`}
          </p>
        </StateCheckboxes>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={close} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" className={PRIMARY_BUTTON_CLASS}>
          {editing ? "Save changes" : "Add contract"}
        </button>
      </div>
    </form>
  );
}
