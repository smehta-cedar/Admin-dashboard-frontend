"use client";

import { useMemo, useState } from "react";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditIcon } from "@/components/edit-icon";
import { EmptyState } from "@/components/empty-state";
import { NoteList } from "@/components/note-list";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { RoleOption, UserNote, UserRecord } from "@/lib/users";
import { saveUser } from "./actions";
import { USER_FIELD_LABELS, UserDialog, type UserEditor, type UserValues } from "./user-dialog";

/*
 * Users table: the accounts that sign in (agent and agency sign-in is a
 * later phase). Add user and a row's Edit open the shared UserDialog; saves
 * go to the users API through the saveUser server action, which records a
 * note of what changed (the password only as set / changed). Clicking a name
 * expands the row to show that user's notes. There is no password column:
 * the API never returns one.
 *
 * The list is server-loaded and kept in state so a save shows at once; the
 * action also revalidates the page, so the next render agrees.
 */

type UsersViewProps = {
  initialUsers: UserRecord[];
  /** Every user's notes, newest first. */
  notes: UserNote[];
  roles: RoleOption[];
};

/** A table row. Wrapped so a column can be added later without renaming fields. */
type UserRow = { user: UserRecord };

/*
 * Sort and search run in DataTable. The actions column is added in the view,
 * since Edit opens its dialog.
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
        {user.isSuperuser ? <span className="ml-1 text-xs text-fg-subtle">(superuser)</span> : null}
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
    id: "phone",
    header: "Phone",
    cell: ({ user }) => user.phone || <span className="text-fg-faint">—</span>,
    className: "whitespace-nowrap text-fg-muted",
    searchText: ({ user }) => user.phone,
  },
  {
    id: "role",
    header: "Role",
    cell: ({ user }) => user.role?.name ?? <span className="text-fg-faint">No role</span>,
    className: "text-fg-muted",
    sortValue: ({ user }) => user.role?.name ?? "",
    searchText: ({ user }) => user.role?.name ?? "",
  },
  {
    id: "status",
    header: "Status",
    cell: ({ user }) => <StatusBadge status={user.status} />,
    sortValue: ({ user }) => statusRank(user.status),
    searchText: ({ user }) => user.status,
  },
];

export function UsersView({ initialUsers, notes, roles }: UsersViewProps) {
  const [users, setUsers] = useState(initialUsers);
  const [editor, setEditor] = useState<UserEditor | null>(null);

  // API order (the order a cleared header sort returns to). Rebuilt when users
  // change, so an add or edit shows at once.
  const rows = useMemo<UserRow[]>(() => users.map((user) => ({ user })), [users]);

  const columns = useMemo<DataTableColumn<UserRow>[]>(
    () => [
      {
        id: "actions",
        header: "Action",
        cell: ({ user }) => (
          <button
            type="button"
            onClick={() => setEditor({ mode: "edit", user })}
            className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
          >
            <EditIcon className="size-3.5 shrink-0" />
            <span className="sr-only"> {user.name}</span>
          </button>
        ),
      },
      ...COLUMNS,
    ],
    [],
  );

  /** Adds or edits a user through the API. Resolves with the dialog's error, if any. */
  const handleSave = async (values: UserValues) => {
    const editing = editor?.mode === "edit" ? editor.user : undefined;
    const result = await saveUser(values, editing);
    if (!result.ok) return result.error;

    const saved = result.user;
    setUsers((current) =>
      editing ? current.map((user) => (user.id === saved.id ? saved : user)) : [saved, ...current],
    );
    return null;
  };

  const addButton = (
    <button type="button" onClick={() => setEditor({ mode: "add" })} className={PRIMARY_BUTTON_CLASS}>
      Add user
    </button>
  );

  return (
    <>
      <PageHeader title="Users" actions={addButton} />

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

      <UserDialog editor={editor} roles={roles} onSave={handleSave} onClose={() => setEditor(null)} />
    </>
  );
}
