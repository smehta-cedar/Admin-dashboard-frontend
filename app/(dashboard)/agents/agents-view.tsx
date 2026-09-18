"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditIcon } from "@/components/edit-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { AgentNote, AgentRecord } from "@/lib/agents";
import { phoneDigits } from "@/lib/phone";
import { US_STATE_NAMES, stateSummary } from "@/lib/us-states";
import { AgentDialog, saveAgent, type AgentEditor, type AgentError, type AgentValues } from "./agent-dialog";

/*
 * Agents table with dummy add and edit, through the shared AgentDialog
 * (./agent-dialog.tsx), which an agent's profile opens too. Every add or edit
 * records a note listing what changed. The table sorts by header and filters
 * by search.
 * A name links to the agent's profile, which shows their aliases and notes;
 * rows don't expand. States are the agent's own licensedStates —
 * where they may write at all; which of those they can actually write with a
 * carrier is that state also being in the carrier's footprint and in an
 * appointment (Contracts). Agents and notes
 * live in component state only: nothing reaches a server, and a refresh brings
 * back the JSON.
 */

type AgentsViewProps = {
  initialAgents: AgentRecord[];
  initialNotes: AgentNote[];
};

export function AgentsView({ initialAgents, initialNotes }: AgentsViewProps) {
  const [agents, setAgents] = useState(initialAgents);
  // Not shown here (the profile lists notes); new ones are still recorded.
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<AgentEditor | null>(null);

  // Sort and search run in DataTable. Search covers aliases too, so an agent can
  // be found by any name they appear under on statements.
  const columns = useMemo<DataTableColumn<AgentRecord>[]>(
    () => [
      {
        id: "id",
        header: "ID",
        cell: (agent) => agent.id,
        className: "font-mono text-fg-muted",
        sortValue: (agent) => Number(agent.id),
        searchText: (agent) => agent.id,
      },
      {
        id: "npn",
        header: "NPN",
        cell: (agent) => agent.npn,
        className: "font-mono text-fg-muted",
        sortValue: (agent) => agent.npn,
        searchText: (agent) => agent.npn,
      },
      {
        id: "name",
        header: "Name",
        cell: (agent) => (
          <Link
            href={`/agents/${agent.id}`}
            className="-ml-1 whitespace-nowrap rounded-md px-1 py-0.5 text-fg hover:bg-surface-hover hover:underline"
          >
            {agent.name}
          </Link>
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
        className: "text-fg-muted",
        sortValue: (agent) => agent.email,
        searchText: (agent) => agent.email,
      },
      {
        id: "phone",
        header: "Phone",
        cell: (agent) => agent.phone,
        className: "whitespace-nowrap text-fg-muted",
        // Digits too, so "5550104410" finds "(555)010-4410".
        searchText: (agent) => [agent.phone, phoneDigits(agent.phone)],
      },
      {
        id: "licensedStates",
        header: "Licensed States",
        cell: (agent) => (
          <span className={agent.licensedStates.length === 0 ? "text-fg-faint" : undefined}>
            {stateSummary(agent.licensedStates)}
          </span>
        ),
        className: "tabular-nums text-fg-muted",
        sortValue: (agent) => agent.licensedStates.length,
        searchText: (agent) =>
          agent.licensedStates.flatMap((code) => [
            code,
            US_STATE_NAMES[code] ?? "",
            agent.licenseNumbers[code] ?? "",
          ]),
      },
      {
        id: "actions",
        header: "Actions",
        srOnlyHeader: true,
        cell: (agent) => (
          <button
            type="button"
            onClick={() => setEditor({ mode: "edit", agent })}
            className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
          >
            <EditIcon className="size-3.5 shrink-0" />
            Edit<span className="sr-only"> {agent.name}</span>
          </button>
        ),
        className: "text-right",
      },
    ],
    [],
  );

  /** Adds or edits an agent. Returns the dialog's error, if any. */
  const handleSave = (values: AgentValues): AgentError | null => {
    const editing = editor?.mode === "edit" ? editor.agent : undefined;
    const result = saveAgent({ agents, notes, values, editing });
    if (result.error !== null) return result.error;
    if (!result.changed) return null;

    const saved = result.agent;
    setAgents((current) =>
      editing ? current.map((agent) => (agent.id === saved.id ? saved : agent)) : [...current, saved],
    );
    setNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    return null;
  };

  const addButton = (
    <button type="button" onClick={() => setEditor({ mode: "add" })} className={PRIMARY_BUTTON_CLASS}>
      Add agent
    </button>
  );

  return (
    <>
      <PageHeader title="Agents" actions={addButton} />

      <div role="status">
        {unsavedCount > 0 ? (
          <p className="mb-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink">
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
          searchPlaceholder="Search name, NPN, email, state…"
        />
      )}

      <AgentDialog editor={editor} onSave={handleSave} onClose={() => setEditor(null)} />
    </>
  );
}
