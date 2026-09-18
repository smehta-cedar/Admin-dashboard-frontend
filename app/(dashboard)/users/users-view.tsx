"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { NoteList } from "@/components/note-list";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { UserNote, UserRecord } from "@/lib/users";
import { CredentialValue } from "../logins/credential-value";
import {
  ROLE_LABELS,
  saveUser,
  USER_FIELD_LABELS,
  UserDialog,
  type AgentOption,
  type UserEditor,
} from "./user-dialog";

/*
 * Users table with dummy add and edit dialogs. Every add or edit records a
 * note listing what changed (the linked agent by name, the password only as
 * "changed"); clicking a name expands the row to show that user's notes. Users
 * and notes live in component state only: nothing reaches a server, and a
 * refresh brings back the JSON.
 */

type UsersViewProps = {
  initialUsers: UserRecord[];
  initialNotes: UserNote[];
  agents: AgentOption[];
};

/** A table row: the user with the linked agent looked up (null when not an agent). */
type UserRow = { user: UserRecord; agent: AgentOption | null };

/*
 * Sort and search run in DataTable. The password is neither sortable nor
 * searchable, so typing part of one never reveals which row it belongs to.
 * The actions column is added in the view, since Edit opens its dialog.
 */
const COLUMNS: DataTableColumn<UserRow>[] = [
  {
    id: "name",
    header: "Name",
    cell: ({ user }, { expanded, toggleExpanded, detailsId }) => (
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-controls={expanded ? detailsId : undefined}
        className="-ml-1 flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 text-fg hover:bg-surface-hover"
      >
        {user.name}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`size-4 shrink-0 text-fg-subtle transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 5l5 5-5 5" />
        </svg>
      </button>
    ),
    sortValue: ({ user }) => user.name,
    searchText: ({ user }) => user.name,
  },
  {
    id: "email",
    header: "Email",
    cell: ({ user }) => user.email,
    className: "text-fg-muted",
    sortValue: ({ user }) => user.email,
    searchText: ({ user }) => user.email,
  },
  {
    id: "password",
    header: "Password",
    cell: ({ user }) => <CredentialValue value={user.password} label="password" secret />,
    className: "text-fg-muted",
  },
  {
    id: "role",
    header: "Role",
    cell: ({ user }) => ROLE_LABELS[user.role],
    className: "text-fg-muted",
    sortValue: ({ user }) => ROLE_LABELS[user.role],
    searchText: ({ user }) => ROLE_LABELS[user.role],
  },
  {
    id: "status",
    header: "Status",
    cell: ({ user }) => <StatusBadge status={user.status} />,
    sortValue: ({ user }) => statusRank(user.status),
    searchText: ({ user }) => user.status,
  },
  {
    id: "agent",
    header: "Linked agent",
    cell: ({ agent }) =>
      agent ? (
        <Link
          href={`/agents/${agent.id}`}
          className="-ml-1 whitespace-nowrap rounded-md px-1 py-0.5 text-fg hover:bg-surface-hover hover:underline"
        >
          {agent.name}
        </Link>
      ) : (
        <span className="text-fg-subtle">—</span>
      ),
    sortValue: ({ agent }) => agent?.name ?? "",
    searchText: ({ agent }) => agent?.name ?? "",
  },
];

export function UsersView({ initialUsers, initialNotes, agents }: UsersViewProps) {
  const [users, setUsers] = useState(initialUsers);
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<UserEditor | null>(null);

  // ID order (the order a cleared header sort returns to). Rebuilt when users
  // change, so an add or edit shows at once.
  const rows = useMemo<UserRow[]>(() => {
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    return users.map((user) => ({
      user,
      agent: user.agentId
        ? (agentsById.get(user.agentId) ?? { id: user.agentId, name: `Agent ${user.agentId}`, status: "active" })
        : null,
    }));
  }, [users, agents]);

  const columns = useMemo<DataTableColumn<UserRow>[]>(
    () => [
      ...COLUMNS,
      {
        id: "actions",
        header: "Actions",
        srOnlyHeader: true,
        cell: ({ user }) => (
          <button
            type="button"
            onClick={() => setEditor({ mode: "edit", user })}
            className={ROW_BUTTON_CLASS}
          >
            Edit<span className="sr-only"> {user.name}</span>
          </button>
        ),
        className: "text-right",
      },
    ],
    [],
  );

  const addButton = (
    <button type="button" onClick={() => setEditor({ mode: "add" })} className={PRIMARY_BUTTON_CLASS}>
      Add user
    </button>
  );

  return (
    <>
      <PageHeader title="Users" actions={addButton} />

      <div role="status">
        {unsavedCount > 0 ? (
          <p className="mb-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            {unsavedCount === 1 ? "1 change" : `${unsavedCount} changes`} made on this page only.
            Nothing is saved yet, so refreshing undoes {unsavedCount === 1 ? "it" : "them"}.
          </p>
        ) : null}
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="No users yet"
          description="Add a user to see them listed here."
          action={addButton}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={({ user }) => user.id}
          unit={["user", "users"]}
          searchPlaceholder="Search name, email, role…"
          renderDetails={({ user }) => (
            <section className="max-w-2xl">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                Notes
              </h3>
              <NoteList
                notes={notes.filter((note) => note.userId === user.id)}
                labels={USER_FIELD_LABELS}
              />
            </section>
          )}
        />
      )}

      <UserDialog
        editor={editor}
        agents={agents}
        onSave={(values) => {
          if (!editor) return null;
          const editing = editor.mode === "edit" ? editor.user : undefined;
          const result = saveUser({ users, notes, agents, values, editing });
          if (result.error) return result.error;
          if (result.changed) {
            const saved = result.user;
            setUsers((current) =>
              editing
                ? current.map((user) => (user.id === saved.id ? saved : user))
                : [...current, saved],
            );
            setNotes(result.notes);
            setUnsavedCount((count) => count + 1);
          }
          return null;
        }}
        onClose={() => setEditor(null)}
      />
    </>
  );
}
