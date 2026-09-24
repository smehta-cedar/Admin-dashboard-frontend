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
import { formatAddress } from "@/lib/address";
import type { AgentRecord } from "@/lib/agents";
import { phoneDigits } from "@/lib/phone";
import { AgentDialog, type AgentEditor } from "./agent-dialog";
import { useAgentsStore } from "./agents-store";

/*
 * Agents table with dummy add and edit. A row's Edit opens the shared
 * AgentDialog (./agent-dialog.tsx), which an agent's profile opens too; Add
 * agent is a link to the /agents/new page, which renders the same form. Every
 * add or edit records a note listing what changed. The table sorts by header
 * and filters by search.
 * A name links to the agent's profile, which shows their aliases, notes and
 * state licences; rows don't expand and the list has no states column, so
 * search doesn't cover states either. Personal email, personal phone and
 * address have no column but are searchable through the work email and phone
 * columns and the name column. The dialog's licensed states and
 * numbers are the agent's licence rows, which saveAgent edits. Agents,
 * licence rows, notes and the unsaved count live in the section's store
 * (./agents-store.tsx), shared with the Add agent page: nothing reaches a
 * server, and a refresh brings back the JSON.
 */

export function AgentsView() {
  const { agents, unsavedCount, save } = useAgentsStore();
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
        // The address rides along here: it has no column of its own.
        searchText: (agent) => [agent.name, ...agent.aliases, formatAddress(agent.address)],
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
        searchText: (agent) => [agent.email, agent.personalEmail ?? ""],
      },
      {
        id: "phone",
        header: "Phone",
        cell: (agent) => agent.phone,
        className: "whitespace-nowrap text-fg-muted",
        // Digits too, so "5550104410" finds "(555)010-4410". The personal phone too.
        searchText: (agent) => [
          agent.phone,
          phoneDigits(agent.phone),
          agent.personalPhone ?? "",
          phoneDigits(agent.personalPhone ?? ""),
        ],
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
            <span className="sr-only"> {agent.name}</span>
          </button>
        ),
        className: "text-right",
      },
    ],
    [],
  );

  const addLink = (
    <Link href="/agents/new" className={PRIMARY_BUTTON_CLASS}>
      Add agent
    </Link>
  );

  return (
    <>
      <PageHeader title="Agents" actions={addLink} />

      <UnsavedBanner count={unsavedCount} />

      {agents.length === 0 ? (
        <EmptyState
          title="No agents yet"
          description="Add an agent to see them listed here."
          action={addLink}
        />
      ) : (
        <DataTable
          rows={agents}
          columns={columns}
          getRowId={(agent) => agent.id}
          unit={["agent", "agents"]}
        />
      )}

      <AgentDialog
        editor={editor}
        onSave={(values) => save(values, editor?.mode === "edit" ? editor.agent : undefined)}
        onClose={() => setEditor(null)}
      />
    </>
  );
}
