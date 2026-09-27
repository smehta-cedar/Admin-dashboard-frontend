"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { StateCheckboxes } from "@/components/state-checkboxes";
import type { AgentRecord } from "@/lib/agents";
import type {
  AppointmentError,
  AppointmentValues,
  CarrierContractField,
  CarrierContractRecord,
} from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import { intersectStates, stateSummary } from "@/lib/us-states";
import { byName } from "@/lib/text";

/*
 * The one Add / Edit contract dialog, shared by Contracts by carrier, Contracts
 * by state and the agent profile so every entry point (Add contract, a card's
 * add-agent icon, Add carrier, Edit, a state panel line) opens the same form:
 * agent, carrier, writing number and a state checkbox grid. Add starts empty
 * or with an agent or carrier picked; Edit starts filled in from the contract.
 *
 * The state grid lists the chosen carrier's whole footprint (availableStates,
 * set on Carriers), but a box is only enabled when the chosen agent is also
 * licensed there (licensedStates, set on Agents): an appointment can only cover
 * states where the agent may write at all and the carrier sells. The rest stay
 * visible but disabled, so it is clear what a new licence would open up; Select
 * all skips them and they never submit. Editing a contract whose states fall
 * outside that ceiling warns, then saving strips them.
 *
 * The carrier select offers only carriers open to agents (agentAccessible:
 * the agency's contract with them has a contract number), plus an edited
 * contract's own carrier so it stays the current choice. A preset carrier
 * that isn't open starts the select empty.
 *
 * Each view passes `onSave` (usually the hook's saveContract, which calls the
 * saveAppointment server action). The API checks one contract per agent per
 * carrier, a writing number unique within that carrier, and every state
 * against both ceilings, naming the side that blocks it, then records the
 * change note. While the save is in flight the buttons are disabled.
 */

type AgentOption = Pick<AgentRecord, "id" | "name" | "status" | "licensedStates">;
type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status" | "availableStates" | "agentAccessible">;

/** Which dialog is open. Add may start on an agent or carrier; edit holds the contract as it was. */
export type AppointmentEditor =
  | { mode: "add"; agentId?: string; carrierId?: string }
  | { mode: "edit"; contract: CarrierContractRecord };

export type { AppointmentError, AppointmentValues } from "@/lib/carrier-contracts";

/** Also the order changes are listed in on a note. */
export const APPOINTMENT_FIELD_LABELS: Record<CarrierContractField, string> = {
  agentId: "Agent",
  carrierId: "Carrier",
  writingNumber: "Writing number",
  appointedStates: "States",
};

/** Unique codes in code order, so a list's order never shows up as a change. */
export const normalizeStates = (codes: string[]) => [...new Set(codes)].sort();

type AppointmentDialogProps = {
  /** Null keeps the dialog closed. */
  editor: AppointmentEditor | null;
  /** Every agent; inactive ones are marked, like inactive carriers. */
  agents: AgentOption[];
  carriers: CarrierOption[];
  /** Saves the values; resolves with an error to show instead of closing. */
  onSave: (values: AppointmentValues, editing?: CarrierContractRecord) => Promise<AppointmentError | null>;
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
  const [saving, setSaving] = useState(false);
  const carrierOptions = [...carriers]
    .filter((option) => option.agentAccessible || option.id === editing?.carrierId)
    .sort(byName);
  // Both controlled, so the state grid follows whichever of the two changes.
  const [agentId, setAgentId] = useState(
    editing?.agentId ?? (editor.mode === "add" ? editor.agentId : undefined) ?? "",
  );
  const [carrierId, setCarrierId] = useState(() => {
    const preset = editing?.carrierId ?? (editor.mode === "add" ? editor.carrierId : undefined) ?? "";
    return carrierOptions.some((option) => option.id === preset) ? preset : "";
  });

  const agent = agents.find((option) => option.id === agentId);
  const carrier = carriers.find((option) => option.id === carrierId);
  // The states that can be checked: where the agent is licensed and the carrier is available.
  const ceiling =
    agent && carrier ? intersectStates(agent.licensedStates, carrier.availableStates) : [];
  // The grid lists the carrier's whole footprint; boxes outside the ceiling are disabled.
  const offered = agent && carrier ? carrier.availableStates : [];
  const unlicensedOffered = offered.filter((code) => !ceiling.includes(code));
  // States the contract had that the pair no longer allows; saving drops them.
  const stripped =
    agent && carrier
      ? normalizeStates(editing?.appointedStates ?? []).filter((code) => !ceiling.includes(code))
      : [];
  // Why they go: the carrier's footprint is checked first, so a state missing
  // from both is blamed on the carrier once rather than named twice.
  const strippedUnavailable = stripped.filter(
    (code) => !(carrier?.availableStates ?? []).includes(code),
  );
  const strippedUnlicensed = stripped.filter((code) => !strippedUnavailable.includes(code));
  const strippedReason = [
    strippedUnavailable.length > 0
      ? `${carrier?.name} isn't available in ${strippedUnavailable.join(", ")}.`
      : null,
    strippedUnlicensed.length > 0
      ? `${agent?.name} isn't licensed in ${strippedUnlicensed.join(", ")}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const agentError = error?.field === "agentId" ? error.message : null;
  const carrierError = error?.field === "carrierId" ? error.message : null;
  const writingNumberError = error?.field === "writingNumber" ? error.message : null;
  const statesError = error?.field === "appointedStates" ? error.message : null;
  const formError = error?.field === "form" ? error.message : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const text = (field: CarrierContractField) => String(data.get(field) ?? "").trim();
    const values: AppointmentValues = {
      agentId: text("agentId"),
      carrierId: text("carrierId"),
      writingNumber: text("writingNumber"),
      appointedStates: normalizeStates(
        data.getAll("appointedStates").map((code) => String(code).trim()).filter(Boolean),
      ),
    };
    setSaving(true);
    try {
      const saveError = await onSave(values, editing);
      if (saveError) {
        setError(saveError);
        return;
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing ? `Edit ${editing.agentName} at ${editing.carrierName}` : "Add contract"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {editing
          ? "Saving records a note of what changed."
          : "The contract is added for everyone, with a note of what was entered."}
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
            value={agentId}
            aria-invalid={agentError ? true : undefined}
            aria-describedby={agentError ? `${id}-agent-error` : undefined}
            onChange={(event) => {
              setAgentId(event.target.value);
              setError(null);
            }}
            className={INPUT_CLASS}
          >
            <option value="">Choose an agent</option>
            {[...agents].sort(byName).map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
                {agent.status === "inactive" ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Carrier"
          htmlFor={`${id}-carrier`}
          hint={carrierError ?? undefined}
          hintId={`${id}-carrier-error`}
          error
        >
          <select
            id={`${id}-carrier`}
            name="carrierId"
            required
            value={carrierId}
            aria-invalid={carrierError ? true : undefined}
            aria-describedby={carrierError ? `${id}-carrier-error` : undefined}
            onChange={(event) => {
              setCarrierId(event.target.value);
              setError(null);
            }}
            className={INPUT_CLASS}
          >
            <option value="">Choose a carrier</option>
            {carrierOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.status === "inactive" ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Writing number"
          htmlFor={`${id}-writing-number`}
          optional
          hint={writingNumberError ?? "Producer ID at this carrier."}
          hintId={`${id}-writing-number-hint`}
          error={Boolean(writingNumberError)}
        >
          <input
            id={`${id}-writing-number`}
            name="writingNumber"
            type="text"
            autoComplete="off"
            defaultValue={editing?.writingNumber}
            aria-invalid={writingNumberError ? true : undefined}
            aria-describedby={`${id}-writing-number-hint`}
            onChange={() => setError(null)}
            className={INPUT_CLASS}
          />
        </Field>
        <StateCheckboxes
          legend="States"
          name="appointedStates"
          codes={offered}
          disabledCodes={unlicensedOffered}
          disabledTitle={(state) => `Agent not licensed in ${state.name}`}
          defaultChecked={editing?.appointedStates}
          onChange={() => setError(null)}
          className="sm:col-span-2"
          describedBy={`${id}-states-hint${statesError ? ` ${id}-states-error` : ""}`}
          footer={
            <>
              {stripped.length > 0 ? (
                <p className="mt-2 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn-ink">
                  Saving removes {stripped.join(", ")}: {strippedReason}
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
            {!agent || !carrier
              ? "Choose an agent and a carrier to see the carrier's states."
              : carrier.availableStates.length === 0
                ? `${carrier.name} isn't available in any states yet. Add its states on Carriers before appointing agents there.`
                : agent.licensedStates.length === 0
                  ? `${agent.name} isn't licensed in any states yet, so every state is disabled. Add their licensed states on Agents before appointing them with a carrier.`
                  : ceiling.length === 0
                    ? `${agent.name} isn't licensed in any state ${carrier.name} is available in, so every state is disabled. Licensed: ${stateSummary(agent.licensedStates)}.`
                    : `Every state ${carrier.name} is available in is listed${
                        unlicensedOffered.length > 0
                          ? `; the ones ${agent.name} isn't licensed in are disabled`
                          : ""
                      }. Leave all unchecked if none yet; that means no states, not every state.`}
          </p>
        </StateCheckboxes>
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
          {saving ? "Saving…" : editing ? "Save changes" : "Add contract"}
        </button>
      </div>
    </form>
  );
}
