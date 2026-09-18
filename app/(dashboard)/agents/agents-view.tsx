"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditIcon } from "@/components/edit-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import { UnsavedBanner } from "@/components/unsaved-banner";
import type { AgentStateLicenseRecord } from "@/lib/agent-state-licenses";
import type { AgentNote, AgentRecord } from "@/lib/agents";
import { phoneDigits } from "@/lib/phone";
import { AgentDialog, saveAgent, type AgentEditor, type AgentError, type AgentValues } from "./agent-dialog";

/*
 * Agents table with dummy add and edit, through the shared AgentDialog
 * (./agent-dialog.tsx), which an agent's profile opens too. Every add or edit
 * records a note listing what changed. The table sorts by header and filters
 * by search.
 * A name links to the agent's profile, which shows their aliases, notes and
 * state licences; rows don't expand and the list has no states column, so
 * search doesn't cover states either. The dialog's licensed states and
 * numbers are the agent's licence rows, which saveAgent edits, so those are
 * kept here too. Agents, licence rows and notes live in component state only:
 * nothing reaches a server, and a refresh brings back the JSON.
 */

type AgentsViewProps = {
  initialAgents: AgentRecord[];
  initialNotes: AgentNote[];
  /** Every agent's licence rows: the dialog edits them and new row IDs need them all. */
  initialLicenses: AgentStateLicenseRecord[];
};

export function AgentsView({ initialAgents, initialNotes, initialLicenses }: AgentsViewProps) {
  const [agents, setAgents] = useState(initialAgents);
  // Neither shown here (the profile lists both); edits still keep them current.
  const [notes, setNotes] = useState(initialNotes);
  const [licenses, setLicenses] = useState(initialLicenses);
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
    const result = saveAgent({ agents, notes, licenses, values, editing });
    if (result.error !== null) return result.error;
    if (!result.changed) return null;

    const saved = result.agent;
    setAgents((current) =>
      editing ? current.map((agent) => (agent.id === saved.id ? saved : agent)) : [...current, saved],
    );
    setLicenses(result.licenses);
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

      <UnsavedBanner count={unsavedCount} />

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
        />
      )}

      <AgentDialog editor={editor} onSave={handleSave} onClose={() => setEditor(null)} />
    </>
  );
}
