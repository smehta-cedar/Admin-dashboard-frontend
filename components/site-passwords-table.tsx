"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ROW_BUTTON_CLASS } from "@/components/classes";
import { CredentialValue } from "@/components/credential-value";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { DeleteIcon } from "@/components/delete-icon";
import { EditIcon } from "@/components/edit-icon";
import { withPasswordWidths } from "@/components/passwords-table";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { SitePasswordRecord } from "@/lib/site-passwords";

/*
 * The site passwords table on the Passwords page, laid out like the carrier
 * PasswordsTable (components/passwords-table.tsx) right above it: the same
 * columns in the same order and the same fixed widths (`aligned`), with Site
 * in the Carrier slot. Action, Agent (the agency tagged), Site, Links (the
 * site's one link, as "Portal"), Portal username, Password, Status. The site
 * name isn't a link: sites have no profile. The password is neither sortable
 * nor searchable. Rows show in the order given.
 */

const LINK_CLASS = "font-medium text-fg hover:text-brand-ink hover:underline";
const EXTERNAL_LINK_CLASS =
  "font-medium text-brand-ink underline underline-offset-2 decoration-brand-ink/40 hover:decoration-brand-ink";

type ActionsProps = {
  label: string;
  onEdit?: () => void;
  onDelete?: () => void;
};

function RowActions({ label, onEdit, onDelete }: ActionsProps) {
  return (
    <span className="inline-flex items-center">
      {onEdit ? (
        <button type="button" onClick={onEdit} className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}>
          <EditIcon className="size-3.5 shrink-0" />
          <span className="sr-only"> {label}</span>
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${label}`}
          title="Delete"
          className={`inline-flex items-center ${ROW_BUTTON_CLASS} hover:text-danger`}
        >
          <DeleteIcon className="size-3.5 shrink-0" />
        </button>
      ) : null}
    </span>
  );
}

type SitePasswordsTableProps = {
  passwords: SitePasswordRecord[];
  onEdit?: (password: SitePasswordRecord) => void;
  onDelete?: (password: SitePasswordRecord) => void;
  /** Shown when there are no rows (not when a search hides everything). */
  emptyMessage?: ReactNode;
  /** The carrier table's fixed column widths, so the two line up. */
  aligned?: boolean;
};

export function SitePasswordsTable({ passwords, onEdit, onDelete, emptyMessage, aligned = false }: SitePasswordsTableProps) {
  const columns = useMemo<DataTableColumn<SitePasswordRecord>[]>(() => {
    const columns: DataTableColumn<SitePasswordRecord>[] = [
      ...(onEdit || onDelete
        ? [
            {
              id: "actions",
              header: "Action",
              cell: (password: SitePasswordRecord) => (
                <RowActions
                  label={`the password for ${password.agentName} at ${password.siteName}`}
                  onEdit={onEdit ? () => onEdit(password) : undefined}
                  onDelete={onDelete ? () => onDelete(password) : undefined}
                />
              ),
              className: "whitespace-nowrap",
            },
          ]
        : []),
      {
        id: "agent",
        header: "Agent",
        cell: (password) =>
          password.agencyId ? (
            <span className="inline-flex items-center gap-2">
              <Link href="/agency" className={LINK_CLASS}>
                {password.agentName}
              </Link>
              <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-ink">Agency</span>
            </span>
          ) : (
            <Link href={`/agents/${password.agentId}`} className={LINK_CLASS}>
              {password.agentName}
            </Link>
          ),
        className: "whitespace-nowrap text-fg",
        sortValue: (password) => password.agentName,
        searchText: (password) => password.agentName,
      },
      {
        id: "site",
        header: "Site",
        cell: (password) => <span className="font-medium text-fg">{password.siteName}</span>,
        className: "whitespace-nowrap text-fg",
        sortValue: (password) => password.siteName,
        searchText: (password) => password.siteName,
      },
      {
        id: "links",
        header: "Links",
        cell: (password) =>
          password.siteLink ? (
            <a
              href={password.siteLink}
              target="_blank"
              rel="noopener noreferrer"
              title={password.siteLink}
              className={EXTERNAL_LINK_CLASS}
            >
              Portal
              <span className="sr-only"> for {password.siteName}</span>
            </a>
          ) : (
            <span className="text-fg-faint">—</span>
          ),
      },
      {
        id: "username",
        header: "Portal username",
        cell: (password) => <CredentialValue value={password.username} label="username" />,
        className: "text-fg-muted",
        sortValue: (password) => password.username,
        searchText: (password) => password.username,
      },
      {
        id: "password",
        header: "Password",
        cell: (password) => <CredentialValue value={password.portalPassword} label="password" secret />,
        className: "text-fg-muted",
      },
      {
        id: "status",
        header: "Status",
        cell: (password) => <StatusBadge status={password.status} />,
        sortValue: (password) => statusRank(password.status),
        searchText: (password) => password.status,
      },
    ];
    return aligned ? withPasswordWidths(columns) : columns;
  }, [onEdit, onDelete, aligned]);

  return (
    <DataTable
      rows={passwords}
      columns={columns}
      getRowId={(password) => password.id}
      unit={["site password", "site passwords"]}
      emptyMessage={emptyMessage}
    />
  );
}
