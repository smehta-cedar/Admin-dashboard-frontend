"use client";

import Link from "next/link";
import { useId, useMemo, useState, type FormEvent } from "react";
import {
  GHOST_BUTTON_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  ROW_BUTTON_CLASS,
} from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { NoteList } from "@/components/note-list";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { AgentField, AgentNote, AgentRecord } from "@/lib/agents";
import { diffValues, nextId } from "@/lib/change-notes";

/*
 * Agents table with dummy add and edit dialogs. Every add or edit records a
 * note listing what changed. The table sorts by header and filters by search.
 * A name links to the agent's profile; the chevron beside it expands the row to
 * show their aliases and notes. Agents and notes
 * live in component state only: nothing reaches a server, and a refresh brings
 * back the JSON.
 */

type AgentsViewProps = {
  initialAgents: AgentRecord[];
  initialNotes: AgentNote[];
};

/** Which dialog is open. Edit holds the agent as it was when the dialog opened. */
type Editor = { mode: "add" } | { mode: "edit"; agent: AgentRecord };

type AgentValues = Omit<AgentRecord, "id">;

/** Also the order changes are compared and listed in. */
export const FIELD_LABELS: Record<AgentField, string> = {
  name: "Name",
  aliases: "Aliases",
  status: "Status",
  npn: "NPN",
  email: "Email",
  phone: "Phone",
};

const FIELDS = Object.keys(FIELD_LABELS) as AgentField[];


const EMPTY_VALUES = { name: "", aliases: [], npn: "", email: "", phone: "" };

export function AgentsView({ initialAgents, initialNotes }: AgentsViewProps) {
  const [agents, setAgents] = useState(initialAgents);
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [npnError, setNpnError] = useState<string | null>(null);
  const { dialogRef, close: closeDialog } = useModalDialog(editor !== null);
  const id = useId();

  // Sort and search run in DataTable. Search covers aliases too, so an agent can
  // be found by any name they appear under on statements.
  const columns = useMemo<DataTableColumn<AgentRecord>[]>(
    () => [
      {
        id: "id",
        header: "ID",
        cell: (agent) => agent.id,
        className: "font-mono text-gray-600",
        sortValue: (agent) => Number(agent.id),
        searchText: (agent) => agent.id,
      },
      {
        id: "npn",
        header: "NPN",
        cell: (agent) => agent.npn,
        className: "font-mono text-gray-600",
        sortValue: (agent) => agent.npn,
        searchText: (agent) => agent.npn,
      },
      {
        id: "name",
        header: "Name",
        cell: (agent, { expanded, toggleExpanded, detailsId }) => (
          <div className="-ml-1 flex items-center gap-0.5 whitespace-nowrap">
            <Link
              href={`/agents/${agent.id}`}
              className="rounded-md px-1 py-0.5 text-gray-900 hover:bg-gray-100 hover:underline"
            >
              {agent.name}
            </Link>
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              aria-controls={expanded ? detailsId : undefined}
              aria-label={`Details for ${agent.name}`}
              className="rounded-md p-0.5 hover:bg-gray-100"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className={`size-4 shrink-0 text-gray-500 transition-transform ${expanded ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 5l5 5-5 5" />
              </svg>
            </button>
          </div>
        ),
        sortValue: (agent) => agent.name,
        searchText: (agent) => [agent.name, ...agent.aliases],
      },
      {
        id: "status",
        header: "Status",
        cell: (agent) => <StatusBadge status={agent.status} />,
        sortValue: (agent) => statusRank(agent.status),
        searchText: (agent) => agent.status,
      },
      {
        id: "email",
        header: "Email",
        cell: (agent) => agent.email,
        className: "text-gray-600",
        sortValue: (agent) => agent.email,
        searchText: (agent) => agent.email,
      },
      {
        id: "phone",
        header: "Phone",
        cell: (agent) => agent.phone,
        className: "whitespace-nowrap text-gray-600",
        searchText: (agent) => agent.phone,
      },
      {
        id: "actions",
        header: "Actions",
        srOnlyHeader: true,
        cell: (agent) => (
          <button
            type="button"
            onClick={() => setEditor({ mode: "edit", agent })}
            className={ROW_BUTTON_CLASS}
          >
            Edit<span className="sr-only"> {agent.name}</span>
          </button>
        ),
        className: "text-right",
      },
    ],
    [],
  );

  // Runs for every close: Cancel, Escape, backdrop click, or a save. Clearing
  // the editor unmounts the form, which resets it.
  const handleClose = () => {
    setEditor(null);
    setNpnError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;

    const data = new FormData(event.currentTarget);
    const text = (field: AgentField) => String(data.get(field) ?? "").trim();
    const values: AgentValues = {
      name: text("name"),
      aliases: text("aliases")
        .split(",")
        .map((alias) => alias.trim())
        .filter(Boolean),
      status: text("status") === "inactive" ? "inactive" : "active",
      npn: text("npn"),
      email: text("email"),
      phone: text("phone"),
    };

    const editingId = editor.mode === "edit" ? editor.agent.id : null;
    const npnOwner = agents.find((agent) => agent.id !== editingId && agent.npn === values.npn);
    if (npnOwner) {
      setNpnError(`NPN ${values.npn} already belongs to ${npnOwner.name}.`);
      return;
    }

    const agentId = editingId ?? nextId(agents);
    const changes = diffValues(FIELDS, editor.mode === "edit" ? editor.agent : EMPTY_VALUES, values);

    // Saving an edit with nothing changed just closes, without a note.
    if (changes.length > 0) {
      setAgents((current) =>
        editor.mode === "edit"
          ? current.map((agent) => (agent.id === agentId ? { id: agentId, ...values } : agent))
          : [...current, { id: agentId, ...values }],
      );
      setNotes((current) => [
        {
          id: nextId(current),
          agentId,
          kind: editor.mode === "edit" ? "edited" : "added",
          createdAt: new Date().toISOString(),
          changes,
        },
        ...current,
      ]);
      setUnsavedCount((count) => count + 1);
    }
    closeDialog();
  };

  const addButton = (
    <button type="button" onClick={() => setEditor({ mode: "add" })} className={PRIMARY_BUTTON_CLASS}>
      Add agent
    </button>
  );

  const editing = editor?.mode === "edit" ? editor.agent : undefined;

  return (
    <>
      <PageHeader title="Agents" actions={addButton} />

      <div role="status">
        {unsavedCount > 0 ? (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {unsavedCount === 1 ? "1 change" : `${unsavedCount} changes`} made on this page only.
            Nothing is saved yet, so refreshing undoes {unsavedCount === 1 ? "it" : "them"}.
          </p>
        ) : null}
      </div>

      {agents.length === 0 ? (
        <EmptyState
          title="No agents yet"
          description="Add an agent to see them listed here."
          action={addButton}
        />
      ) : (
        <DataTable
          rows={agents}
          columns={columns}
          getRowId={(agent) => agent.id}
          unit={["agent", "agents"]}
          searchPlaceholder="Search name, NPN, email…"
          renderDetails={(agent) => (
            <div className="grid gap-6 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Aliases
                </h3>
                {agent.aliases.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-gray-900">
                    {agent.aliases.map((alias, index) => (
                      <li key={`${index}-${alias}`}>{alias}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">None</p>
                )}
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Notes
                </h3>
                <NoteList
                  notes={notes.filter((note) => note.agentId === agent.id)}
                  labels={FIELD_LABELS}
                />
              </section>
            </div>
          )}
        />
      )}

      <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={handleClose}>
        {editor ? (
          <form onSubmit={handleSubmit} className="p-6">
            <h2 id={`${id}-title`} className="text-base font-semibold text-gray-900">
              {editing ? `Edit ${editing.name}` : "Add agent"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
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
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeDialog} className={GHOST_BUTTON_CLASS}>
                Cancel
              </button>
              <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                {editing ? "Save changes" : "Add agent"}
              </button>
            </div>
          </form>
        ) : null}
      </ModalDialog>
    </>
  );
}
