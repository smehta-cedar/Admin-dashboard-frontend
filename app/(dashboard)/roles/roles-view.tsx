"use client";

import { useMemo, useState } from "react";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditIcon } from "@/components/edit-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { ModuleOption, RoleRecord } from "@/lib/roles";
import { deleteRole, saveRole } from "./actions";
import { PERMISSION_ACTIONS, RoleDialog, type RoleEditor, type RoleValues } from "./role-dialog";

/*
 * Roles table, for superusers only (the page redirects everyone else): what
 * each role may do per module. Add role and a row's Edit open the shared
 * RoleDialog; saves and deletes go to the roles API through the server
 * actions. Clicking a name expands the row to show the role's permission
 * grid. Users are given a role on the Users page.
 *
 * The list is server-loaded and kept in state so a save shows at once; the
 * action also revalidates the page, so the next render agrees.
 */

type RolesViewProps = {
  initialRoles: RoleRecord[];
  /** Every module a role can be granted, in menu order. */
  modules: ModuleOption[];
};

/** A table row. Wrapped so a column can be added later without renaming fields. */
type RoleRow = { role: RoleRecord };

/** How many modules the role can at least view. */
const moduleCount = (role: RoleRecord) => Object.values(role.permissions).filter((flags) => flags.view).length;

/*
 * Sort and search run in DataTable. The access and actions columns are added
 * in the view, since they need the module list and the dialog.
 */
const COLUMNS: DataTableColumn<RoleRow>[] = [
  {
    id: "name",
    header: "Name",
    cell: ({ role }, { expanded, toggleExpanded, detailsId }) => (
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-controls={expanded ? detailsId : undefined}
        className="-ml-1 flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 text-fg hover:bg-surface-hover"
      >
        {role.name}
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
    sortValue: ({ role }) => role.name,
    searchText: ({ role }) => role.name,
  },
  {
    id: "description",
    header: "Description",
    cell: ({ role }) => role.description || <span className="text-fg-faint">—</span>,
    className: "text-fg-muted",
    searchText: ({ role }) => role.description,
  },
  {
    id: "users",
    header: "Users",
    cell: ({ role }) => role.userCount,
    className: "text-fg-muted tabular-nums",
    sortValue: ({ role }) => role.userCount,
  },
  {
    id: "status",
    header: "Status",
    cell: ({ role }) => <StatusBadge status={role.status} />,
    sortValue: ({ role }) => statusRank(role.status),
    searchText: ({ role }) => role.status,
  },
];

export function RolesView({ initialRoles, modules }: RolesViewProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [editor, setEditor] = useState<RoleEditor | null>(null);

  // API order (the order a cleared header sort returns to). Rebuilt when roles
  // change, so an add, edit or delete shows at once.
  const rows = useMemo<RoleRow[]>(() => roles.map((role) => ({ role })), [roles]);

  const columns = useMemo<DataTableColumn<RoleRow>[]>(
    () => [
      {
        id: "actions",
        header: "Action",
        cell: ({ role }) => (
          <button
            type="button"
            onClick={() => setEditor({ mode: "edit", role })}
            className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
          >
            <EditIcon className="size-3.5 shrink-0" />
            <span className="sr-only"> {role.name}</span>
          </button>
        ),
      },
      ...COLUMNS.slice(0, 3),
      {
        id: "access",
        header: "Access",
        cell: ({ role }) => {
          const count = moduleCount(role);
          return count === 0 ? (
            <span className="text-fg-faint">None</span>
          ) : (
            `${count} of ${modules.length} modules`
          );
        },
        className: "whitespace-nowrap text-fg-muted",
        sortValue: ({ role }) => moduleCount(role),
      },
      ...COLUMNS.slice(3),
    ],
    [modules.length],
  );

  /** Adds or edits a role through the API. Resolves with the dialog's error, if any. */
  const handleSave = async (values: RoleValues) => {
    const editing = editor?.mode === "edit" ? editor.role : undefined;
    const result = await saveRole(values, editing?.id);
    if (!result.ok) return result.error;

    const saved = result.role;
    setRoles((current) =>
      editing ? current.map((role) => (role.id === saved.id ? saved : role)) : [...current, saved],
    );
    return null;
  };

  /** Deletes the role being edited. Resolves with the dialog's error, if any. */
  const handleDelete = async (role: RoleRecord) => {
    const result = await deleteRole(role.id);
    if (!result.ok) return result.error;
    setRoles((current) => current.filter((item) => item.id !== role.id));
    return null;
  };

  const addButton = (
    <button type="button" onClick={() => setEditor({ mode: "add" })} className={PRIMARY_BUTTON_CLASS}>
      Add role
    </button>
  );

  return (
    <>
      <PageHeader title="Roles" actions={addButton} />

      {roles.length === 0 ? (
        <EmptyState
          title="No roles yet"
          description="Add a role to decide what its users can see and do."
          action={addButton}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={({ role }) => role.id}
          unit={["role", "roles"]}
          renderDetails={({ role }) => <PermissionGrid role={role} modules={modules} />}
        />
      )}

      <RoleDialog
        editor={editor}
        modules={modules}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setEditor(null)}
      />
    </>
  );
}

/** Read-only: which actions the role may take on each module. */
function PermissionGrid({ role, modules }: { role: RoleRecord; modules: ModuleOption[] }) {
  return (
    <section className="max-w-2xl">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Permissions</h3>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-fg-subtle">
            <th scope="col" className="py-1 pr-4 font-medium">
              Module
            </th>
            {PERMISSION_ACTIONS.map((action) => (
              <th key={action} scope="col" className="w-20 py-1 text-center font-medium capitalize">
                {action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => {
            const flags = role.permissions[module.code];
            return (
              <tr key={module.code} className="border-t border-line">
                <th scope="row" className="py-1.5 pr-4 text-left font-normal text-fg">
                  {module.label}
                </th>
                {PERMISSION_ACTIONS.map((action) => (
                  <td key={action} className="py-1.5 text-center">
                    {flags?.[action] ? (
                      <>
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          className="mx-auto size-4 text-brand-ink"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 10.5l4 4 8-9" />
                        </svg>
                        <span className="sr-only">Yes</span>
                      </>
                    ) : (
                      <span className="text-fg-faint" aria-label="No">
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
