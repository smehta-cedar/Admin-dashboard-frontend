"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { Panel, PanelEmpty, PROFILE_LINK_CLASS, ProfileTable } from "@/components/profile-shell";
import { StatusBadge, type Status } from "@/components/status-badge";

/*
 * The Pending and Archive pages: one card per kind of record
 * (lib/status-sections.ts builds them).
 */

export type StatusRow = {
  id: string;
  name: string;
  detail: string;
  status: Status;
  /** A licence whose renewal is under way. */
  renewing?: boolean;
  /** The list page the record lives in, searched for it; left out when the role can't open it. */
  href?: string;
};

export type StatusSection = {
  title: string;
  /** Headings for `name` and `detail`; Status is added. */
  columns: [string, string];
  rows: StatusRow[];
};

/** `empty` is the whole page's empty message, e.g. "Nothing pending". */
export function StatusSectionsView({ sections, empty }: { sections: StatusSection[]; empty: string }) {
  const router = useRouter();

  if (sections.every((section) => section.rows.length === 0)) {
    return <EmptyState title={empty} />;
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      {sections.map((section) => (
        <Panel key={section.title} title={section.title} count={section.rows.length}>
          {section.rows.length === 0 ? (
            <PanelEmpty>{empty}.</PanelEmpty>
          ) : (
            <ProfileTable
              columns={[...section.columns, "Status"]}
              rows={section.rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => row.href && router.push(row.href)}
            >
              {(row) => (
                <>
                  <td className="min-w-0 truncate px-3 py-2.5 align-middle">
                    {row.href ? (
                      <Link href={row.href} className={PROFILE_LINK_CLASS}>
                        {row.name}
                      </Link>
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="min-w-0 truncate px-3 py-2.5 align-middle text-fg-muted">{row.detail || "—"}</td>
                  <td className="px-3 py-2.5 align-middle">
                    <StatusBadge status={row.status} renewing={row.renewing} />
                  </td>
                </>
              )}
            </ProfileTable>
          )}
        </Panel>
      ))}
    </div>
  );
}
