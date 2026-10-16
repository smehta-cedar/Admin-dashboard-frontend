"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ROW_BUTTON_CLASS } from "@/components/classes";
import { CredentialValue } from "@/components/credential-value";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { DeleteIcon } from "@/components/delete-icon";
import { EditIcon } from "@/components/edit-icon";
import { StatusBadge, statusRank } from "@/components/status-badge";
import type { PasswordRecord } from "@/lib/passwords";

/*
 * The one carrier passwords table, used by the Passwords page and the
 * Passwords panels on the agent and carrier profiles. Columns: Action (only
 * with `onEdit` or `onDelete`), Agent and Carrier (`parties` picks which: a
 * profile leaves out its own side), the carrier's Links, Portal username,
 * Password and Status. Sort and search run in DataTable; the password is
 * neither sortable nor searchable, so typing part of one never reveals
 * which row it belongs to. Site passwords have their own table
 * (components/site-passwords-table.tsx).
 *
 * The agency's own passwords show the agency in the Agent column with an
 * Agency tag. Names link to the agent's, agency's or carrier's profile
 * unless `linkParties` is off (the agent's own portal, which can't open
 * them). Rows show in the order given.
 */

export type PasswordParty = "agent" | "carrier";

type PasswordsTableProps = {
  passwords: PasswordRecord[];
  /** The name columns to show, in order. Defaults to both (the Passwords page). */
  parties?: PasswordParty[];
  /** Link names to their profiles. Defaults to on. */
  linkParties?: boolean;
  /** Adds Edit to each row. */
  onEdit?: (password: PasswordRecord) => void;
  /** Adds Delete to each row. */
  onDelete?: (password: PasswordRecord) => void;
  /** Shown when a search leaves no rows. */
  emptyMessage?: ReactNode;
  /** Fixed column widths shared with SitePasswordsTable, so the two line up (the Passwords page). */
  aligned?: boolean;
};

/**
 * Column widths on the Passwords page, shared by this table and
 * SitePasswordsTable so their columns line up: Carrier and Site take the
 * same slot. Each table needs all seven columns for these to add up.
 */
export const PASSWORD_COLUMN_WIDTHS: Record<string, string> = {
  actions: "7%",
  agent: "20%",
  place: "16%",
  links: "12%",
  username: "17%",
  password: "17%",
  status: "11%",
};

/** `columns` with their PASSWORD_COLUMN_WIDTHS share; carrier and site use the "place" slot. */
export function withPasswordWidths<T extends { id: string; width?: string }>(columns: T[]): T[] {
  return columns.map((column) => ({
    ...column,
    width: PASSWORD_COLUMN_WIDTHS[column.id === "carrier" || column.id === "site" ? "place" : column.id],
  }));
}

const BOTH_PARTIES: PasswordParty[] = ["agent", "carrier"];

const LINK_CLASS = "font-medium text-fg hover:text-brand-ink hover:underline";
const EXTERNAL_LINK_CLASS =
  "font-medium text-brand-ink underline underline-offset-2 decoration-brand-ink/40 hover:decoration-brand-ink";

/** "Maria Alva at Humana", for the row buttons' labels. */
const rowLabel = (password: PasswordRecord) => `${password.agentName} at ${password.carrierName}`;

export function PasswordsTable({
  passwords,
  parties = BOTH_PARTIES,
  linkParties = true,
  onEdit,
  onDelete,
  emptyMessage,
  aligned = false,
}: PasswordsTableProps) {
  const columns = useMemo<DataTableColumn<PasswordRecord>[]>(() => {
    const name = (text: string, href: string) =>
      linkParties ? (
        <Link href={href} className={LINK_CLASS}>
          {text}
        </Link>
      ) : (
        text
      );

    const partyColumns: Record<PasswordParty, DataTableColumn<PasswordRecord>> = {
      agent: {
        id: "agent",
        header: "Agent",
        cell: (password) =>
          password.agencyId ? (
            <span className="inline-flex items-center gap-2">
              {name(password.agentName, "/agency")}
              <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-ink">Agency</span>
            </span>
          ) : (
            name(password.agentName, `/agents/${password.agentId}`)
          ),
        className: "whitespace-nowrap text-fg",
        sortValue: (password) => password.agentName,
        searchText: (password) => password.agentName,
      },
      carrier: {
        id: "carrier",
        header: "Carrier",
        cell: (password) => name(password.carrierName, `/carriers/${password.carrierId}`),
        className: "whitespace-nowrap text-fg",
        sortValue: (password) => password.carrierName,
        searchText: (password) => password.carrierName,
      },
    };

    const columns: DataTableColumn<PasswordRecord>[] = [
      ...(onEdit || onDelete
        ? [
            {
              id: "actions",
              header: "Action",
              cell: (password: PasswordRecord) => (
                <span className="inline-flex items-center">
                  {onEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(password)}
                      className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
                    >
                      <EditIcon className="size-3.5 shrink-0" />
                      <span className="sr-only"> {rowLabel(password)}</span>
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(password)}
                      aria-label={`Delete the password for ${rowLabel(password)}`}
                      title="Delete"
                      className={`inline-flex items-center ${ROW_BUTTON_CLASS} hover:text-danger`}
                    >
                      <DeleteIcon className="size-3.5 shrink-0" />
                    </button>
                  ) : null}
                </span>
              ),
              className: "whitespace-nowrap",
            },
          ]
        : []),
      ...parties.map((party) => partyColumns[party]),
      {
        id: "links",
        header: "Links",
        cell: (password) =>
          password.carrierLinks.length > 0 ? (
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {password.carrierLinks.map((link) => (
                <li key={link.name}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" title={link.url} className={EXTERNAL_LINK_CLASS}>
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-fg-faint">—</span>
          ),
        searchText: (password) => password.carrierLinks.map((link) => link.name).join(" "),
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
  }, [parties, linkParties, onEdit, onDelete, aligned]);

  return (
    <DataTable
      rows={passwords}
      columns={columns}
      getRowId={(password) => password.id}
      unit={["password", "passwords"]}
      emptyMessage={emptyMessage}
    />
  );
}
