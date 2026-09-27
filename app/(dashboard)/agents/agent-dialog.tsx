"use client";

import { useId } from "react";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { ProducerForm, type ProducerError, type ProducerLabels } from "@/components/producer-form";
import type { AgentField, AgentRecord, AgentValues } from "@/lib/agents";
import { agentContactExtra, incompleteAddressError, type AgentContact } from "./agent-contact-fields";

/*
 * The one Add / Edit agent dialog: the shared ProducerForm
 * (components/producer-form.tsx) with agent wording — name, aliases, status,
 * NPN, email, phone, licensed states, and the licence number for each state
 * that is checked — plus the agent-only personal contact section
 * (./agent-contact-fields.tsx: personal email, personal phone, address),
 * which the agency's copy of the form doesn't have. The Agents page opens it
 * from a row's Edit and the Add agent page renders the same form; an
 * agent's profile opens it in edit mode from its own Edit button, so every
 * place edits an agent with exactly the same form and the same checks.
 *
 * Each place passes `onSave`, which calls the saveAgent server action
 * (./actions.ts) and updates its own state from the saved agent and licence
 * rows. The API checks the NPN against every other agent, keeps the licence
 * rows in step with the checked states, and records the change note. The
 * form itself only checks what it can see at once: a number for every
 * checked state, and an address that is all four parts or none.
 */

/**
 * Which dialog is open. Edit holds the agent as it was when the dialog opened.
 * Add is still supported, though the list now links to /agents/new instead.
 */
export type AgentEditor = { mode: "add" } | { mode: "edit"; agent: AgentRecord };

export type { AgentValues } from "@/lib/agents";

/** A save error, shown under the field it names. */
export type AgentError = ProducerError;

/** Also the order changes are listed in on a note. */
export const AGENT_FIELD_LABELS: Record<AgentField, string> = {
  name: "Name",
  aliases: "Aliases",
  status: "Status",
  npn: "NPN",
  email: "Email",
  phone: "Phone",
  personalEmail: "Personal email",
  personalPhone: "Personal phone",
  address: "Address",
  licensedStates: "Licensed states",
  licenseNumbers: "Licence numbers",
};

const FORM_LABELS: ProducerLabels = {
  name: "Name",
  aliases: "Aliases",
  aliasesHint: "Other names on statements, separated by commas.",
  npn: "NPN",
  licensedHint: "Where this agent holds a licence.",
};

/** What every caller's `onSave` does before the API: the address check the form can run itself. */
export function checkAgentValues(values: AgentValues): AgentError | null {
  return incompleteAddressError(values);
}

type AgentDialogProps = {
  /** Null keeps the dialog closed. */
  editor: AgentEditor | null;
  /** Saves the values; resolves with the error to show instead of closing. */
  onSave: (values: AgentValues) => Promise<AgentError | null>;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

type AgentFormProps = {
  /** Prefix for element IDs; the `<h2>` is `${id}-title`. */
  id: string;
  /** The agent being edited; leave out for an empty add form. */
  editing?: AgentRecord;
  onSave: (values: AgentValues) => Promise<AgentError | null>;
  /** Cancel, and what runs after a successful save. */
  close: () => void;
};

/** The agent form itself: the producer form with agent wording and the personal contact section. */
export function AgentForm({ id, editing, onSave, close }: AgentFormProps) {
  return (
    <ProducerForm<AgentContact>
      id={id}
      title={editing ? `Edit ${editing.name}` : "Add agent"}
      description={
        editing
          ? "Saving records a note of what changed on the agent's profile."
          : "The agent is added for everyone, with a note of what was entered."
      }
      submitLabel={editing ? "Save changes" : "Add agent"}
      labels={FORM_LABELS}
      initial={editing}
      extra={agentContactExtra(editing)}
      onSave={(values) => checkAgentValues(values) ?? onSave(values)}
      close={close}
    />
  );
}

export function AgentDialog({ editor, onSave, onClose }: AgentDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();
  const editing = editor?.mode === "edit" ? editor.agent : undefined;

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? <AgentForm id={id} editing={editing} onSave={onSave} close={close} /> : null}
    </ModalDialog>
  );
}
