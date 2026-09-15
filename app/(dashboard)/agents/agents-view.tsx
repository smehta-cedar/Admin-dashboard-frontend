"use client";

import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import type {
  AgentChange,
  AgentField,
  AgentNote,
  AgentRecord,
  AgentStatus,
} from "@/lib/agents";

/*
 * Agents table with dummy add and edit dialogs. Every add or edit records a
 * note listing what changed; clicking a name expands the row to show that
 * agent's aliases and notes. Agents and notes live in component state only:
 * nothing reaches a server, and a refresh brings back the JSON.
 */

type AgentsViewProps = {
  initialAgents: AgentRecord[];
  initialNotes: AgentNote[];
};

/** Which dialog is open. Edit holds the agent as it was when the dialog opened. */
type Editor = { mode: "add" } | { mode: "edit"; agent: AgentRecord };

type AgentValues = Omit<AgentRecord, "id">;

/** Also the order changes are compared and listed in. */
const FIELD_LABELS: Record<AgentField, string> = {
  name: "Name",
  aliases: "Aliases",
  status: "Status",
  npn: "NPN",
  email: "Email",
  phone: "Phone",
};

const FIELDS = Object.keys(FIELD_LABELS) as AgentField[];

const COLUMNS = ["ID", "NPN", "Name", "Status", "Email", "Phone"];

const EMPTY_VALUES = { name: "", aliases: [], npn: "", email: "", phone: "" };

const STATUS_STYLES: Record<AgentStatus, string> = {
  active: "bg-green-50 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
};

const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 aria-invalid:border-red-600";

const PRIMARY_BUTTON_CLASS =
  "rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700";

/** Next number after the highest ID, so lists stay 1…n. */
function nextId(items: { id: string }[]) {
  return String(items.reduce((max, item) => Math.max(max, Number(item.id)), 0) + 1);
}

function fieldText(values: Partial<AgentValues>, field: AgentField) {
  const value = values[field];
  return Array.isArray(value) ? value.join(", ") : (value ?? "");
}

/** Fields whose shown value differs, in form order. */
function diffValues(before: Partial<AgentValues>, after: AgentValues): AgentChange[] {
  return FIELDS.flatMap((field) => {
    const from = fieldText(before, field);
    const to = fieldText(after, field);
    return from === to ? [] : [{ field, from, to }];
  });
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function AgentsView({ initialAgents, initialNotes }: AgentsViewProps) {
  const [agents, setAgents] = useState(initialAgents);
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [npnError, setNpnError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();

  const toggleExpanded = (agentId: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(agentId)) next.add(agentId);
      return next;
    });

  // The form mounts with the editor, so open the dialog once it has rendered.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (editor && dialog && !dialog.open) dialog.showModal();
  }, [editor]);

  const closeDialog = () => dialogRef.current?.close();

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
    const changes = diffValues(editor.mode === "edit" ? editor.agent : EMPTY_VALUES, values);

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
      <PageHeader title="Agents"  actions={addButton} />

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
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                {COLUMNS.map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-600"
                  >
                    {heading}
                  </th>
                ))}
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 border-t border-gray-200">
              {agents.map((agent) => {
                const expanded = expandedIds.has(agent.id);
                const detailsId = `${id}-details-${agent.id}`;

                return (
                  <Fragment key={agent.id}>
                    <tr className={expanded ? "bg-gray-50" : undefined}>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{agent.id}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{agent.npn}</td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(agent.id)}
                          aria-expanded={expanded}
                          aria-controls={expanded ? detailsId : undefined}
                          className="-ml-1 flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 text-gray-900 hover:bg-gray-100"
                        >{agent.name}
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
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[agent.status]}`}
                        >
                          {agent.status}
                        </span>
                      </td>

                      <td className="px-4 py-2.5 text-gray-600">{agent.email}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{agent.phone}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setEditor({ mode: "edit", agent })}
                          className="rounded-md px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100"
                        >
                          Edit<span className="sr-only"> {agent.name}</span>
                        </button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr id={detailsId} className="bg-gray-50">
                        <td colSpan={COLUMNS.length + 1} className="px-4 pb-4 pt-1">
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
                              <NoteList notes={notes.filter((note) => note.agentId === agent.id)} />
                            </section>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        onClose={handleClose}
        // The form fills the dialog, so only backdrop clicks land here.
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
      >
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
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                {editing ? "Save changes" : "Add agent"}
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  );
}

function NoteList({ notes }: { notes: AgentNote[] }) {
  if (notes.length === 0) {
    return <p className="mt-2 text-sm text-gray-500">No changes recorded yet.</p>;
  }

  return (
    <ol className="mt-2 space-y-2">
      {notes.map((note) => (
        <li key={note.id} className="rounded-md border border-gray-200 bg-white px-3 py-2">
          <p className="text-xs text-gray-500">
            {note.kind === "added" ? "Added" : "Edited"} ·{" "}
            <time dateTime={note.createdAt}>{formatTimestamp(note.createdAt)}</time>
          </p>
          <ul className="mt-1 space-y-0.5 break-words text-sm text-gray-700">
            {note.changes.map((change) => (
              <li key={change.field}>
                <span className="font-medium text-gray-900">{FIELD_LABELS[change.field]}:</span>{" "}
                {note.kind === "added" ? (
                  change.to
                ) : (
                  <>
                    {change.from || "(empty)"} <span aria-hidden="true">→</span>
                    <span className="sr-only">changed to</span> {change.to || "(empty)"}
                  </>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  optional?: boolean;
  /** Help text below the input, or the error message when `error` is set. */
  hint?: string;
  hintId?: string;
  error?: boolean;
  className?: string;
  children: ReactNode;
};

function Field({ label, htmlFor, optional, hint, hintId, error, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-900">
        {label}
        {optional ? <span className="font-normal text-gray-500"> (optional)</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className={`mt-1 text-xs ${error ? "text-red-700" : "text-gray-500"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
