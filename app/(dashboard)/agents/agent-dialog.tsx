"use client";

import { useId } from "react";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import {
  ProducerForm,
  producerNoteValues,
  unnumberedStatesError,
  type ProducerError,
  type ProducerLabels,
} from "@/components/producer-form";
import type { AgentField, AgentNote, AgentRecord } from "@/lib/agents";
import { diffValues, nextId } from "@/lib/change-notes";

/*
 * The one Add / Edit agent dialog: the shared ProducerForm
 * (components/producer-form.tsx) with agent wording — name, aliases, status,
 * NPN, email, phone, licensed states, and the licence number for each state
 * that is checked. The Agents page opens it from Add agent and a row's Edit; an
 * agent's profile opens it in edit mode from its own Edit button, so both
 * places edit an agent with exactly the same form and the same checks.
 *
 * Each view owns its agents and notes state and passes `onSave`, which usually
 * calls `saveAgent` below and sets that state. Adds and edits are dummy:
 * nothing reaches a server, and a refresh brings back the JSON.
 */

/** Which dialog is open. Edit holds the agent as it was when the dialog opened. */
export type AgentEditor = { mode: "add" } | { mode: "edit"; agent: AgentRecord };

export type AgentValues = Omit<AgentRecord, "id">;

/** A save error, shown under the field it names. */
export type AgentError = ProducerError;

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

const FORM_LABELS: ProducerLabels = {
  name: "Name",
  aliases: "Aliases",
  aliasesHint: "Other names on statements, separated by commas.",
  npn: "NPN",
  licensedHint: "Where this agent holds a licence.",
};

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
  const unnumbered = unnumberedStatesError(values);
  if (unnumbered) return { error: unnumbered, agent: null };

  const agentId = editing?.id ?? nextId(agents);
  const saved = { id: agentId, ...values };
  const changes = diffValues(
    FIELDS,
    editing ? producerNoteValues(editing) : {},
    producerNoteValues(values),
  );
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
  const editing = editor?.mode === "edit" ? editor.agent : undefined;

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? (
        <ProducerForm
          id={id}
          title={editing ? `Edit ${editing.name}` : "Add agent"}
          description={
            editing
              ? "Saving records a note of what changed. Nothing is saved anywhere yet; refreshing undoes it."
              : "Not saved anywhere yet. The agent stays in the list until you refresh."
          }
          submitLabel={editing ? "Save changes" : "Add agent"}
          labels={FORM_LABELS}
          initial={editing}
          onSave={onSave}
          close={close}
        />
      ) : null}
    </ModalDialog>
  );
}
