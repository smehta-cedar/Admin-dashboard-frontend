"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { useRequestsStore, type RequestParty } from "@/components/requests-store";
import {
  REQUEST_TYPES,
  REQUEST_TYPE_LABELS,
  type RequestError,
  type RequestValues,
} from "@/lib/request-options";
import type { AgentRequestType } from "@/lib/requests";
import { US_STATES } from "@/lib/us-states";

/*
 * The Create-a-request popup the navbar opens from any page: one dialog, the
 * type first, then the fields that type needs — a state and a carrier for
 * licensing or a contract, first and last day for a day off — plus the agent
 * it is for and an optional note. Saving files a pending request into the
 * requests store (components/requests-store.tsx), where the HR page picks it
 * up. Nothing reaches a server; a refresh brings back the JSON.
 *
 * Mounted per open inside a ModalDialog, so its fields and errors start
 * clear each time.
 */

type RequestDialogProps = {
  open: boolean;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function RequestDialog({ open, onClose }: RequestDialogProps) {
  const { dialogRef, close } = useModalDialog(open);
  const id = useId();

  // Closing unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {open ? <RequestForm id={id} close={close} /> : null}
    </ModalDialog>
  );
}

/** The submitted form as values; the fields a type doesn't show are blank. */
function readValues(form: HTMLFormElement): RequestValues {
  const data = new FormData(form);
  const text = (field: keyof RequestValues) => String(data.get(field) ?? "").trim();
  const type = text("type");
  return {
    type: REQUEST_TYPES.includes(type as AgentRequestType) ? (type as AgentRequestType) : "licensing",
    agentId: text("agentId"),
    note: text("note"),
    state: text("state"),
    carrierId: text("carrierId"),
    startDate: text("startDate"),
    endDate: text("endDate"),
  };
}

function PartyOptions({ parties, placeholder }: { parties: RequestParty[]; placeholder: string }) {
  return (
    <>
      <option value="">{placeholder}</option>
      {parties.map((party) => (
        <option key={party.id} value={party.id}>
          {party.name}
          {party.status === "inactive" ? " (inactive)" : ""}
        </option>
      ))}
    </>
  );
}

function RequestForm({ id, close }: { id: string; close: () => void }) {
  const { agents, carriers, addRequest } = useRequestsStore();
  const [type, setType] = useState<AgentRequestType>("licensing");
  const [error, setError] = useState<RequestError | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saveError = addRequest(readValues(event.currentTarget));
    if (saveError) {
      setError(saveError);
      return;
    }
    close();
  };

  /** Error props for one field: message under it while the error names it. */
  const errorFor = (field: RequestError["field"]) => {
    const message = error?.field === field ? error.message : null;
    return {
      field: { hint: message ?? undefined, hintId: `${id}-${field}-error`, error: true },
      input: {
        "aria-invalid": message ? (true as const) : undefined,
        "aria-describedby": message ? `${id}-${field}-error` : undefined,
        onChange: () => setError(null),
      },
    };
  };
  const agentError = errorFor("agentId");
  const stateError = errorFor("state");
  const carrierError = errorFor("carrierId");
  const startError = errorFor("startDate");
  const endError = errorFor("endDate");

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        Create a request
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        Files a pending request for HR. Not saved anywhere yet; it stays until you refresh.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor={`${id}-type`}>
          <select
            id={`${id}-type`}
            name="type"
            value={type}
            onChange={(event) => {
              setType(event.target.value as AgentRequestType);
              setError(null);
            }}
            className={INPUT_CLASS}
          >
            {REQUEST_TYPES.map((option) => (
              <option key={option} value={option}>
                {REQUEST_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Agent" htmlFor={`${id}-agent`} {...agentError.field}>
          <select
            id={`${id}-agent`}
            name="agentId"
            required
            defaultValue=""
            className={INPUT_CLASS}
            {...agentError.input}
          >
            <PartyOptions parties={agents} placeholder="Choose an agent" />
          </select>
        </Field>

        {type === "licensing" || type === "contract" ? (
          <>
            <Field label="State" htmlFor={`${id}-state`} {...stateError.field}>
              <select
                id={`${id}-state`}
                name="state"
                required
                defaultValue=""
                className={INPUT_CLASS}
                {...stateError.input}
              >
                <option value="">Choose a state</option>
                {US_STATES.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name} ({state.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Carrier" htmlFor={`${id}-carrier`} {...carrierError.field}>
              <select
                id={`${id}-carrier`}
                name="carrierId"
                required
                defaultValue=""
                className={INPUT_CLASS}
                {...carrierError.input}
              >
                <PartyOptions parties={carriers} placeholder="Choose a carrier" />
              </select>
            </Field>
          </>
        ) : null}

        {type === "dayOff" ? (
          <>
            <Field label="First day" htmlFor={`${id}-start`} {...startError.field}>
              <input
                id={`${id}-start`}
                name="startDate"
                type="date"
                required
                className={INPUT_CLASS}
                {...startError.input}
              />
            </Field>
            <Field label="Last day" htmlFor={`${id}-end`} {...endError.field}>
              <input
                id={`${id}-end`}
                name="endDate"
                type="date"
                required
                className={INPUT_CLASS}
                {...endError.input}
              />
            </Field>
          </>
        ) : null}

        <Field label="Note" optional htmlFor={`${id}-note`} className="sm:col-span-2">
          <textarea
            id={`${id}-note`}
            name="note"
            rows={3}
            autoComplete="off"
            className={`${INPUT_CLASS} resize-y`}
          />
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={close} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" className={PRIMARY_BUTTON_CLASS}>
          Create request
        </button>
      </div>
    </form>
  );
}
