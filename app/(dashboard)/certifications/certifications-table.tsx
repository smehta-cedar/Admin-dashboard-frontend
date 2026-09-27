"use client";

import Link from "next/link";
import { ROW_BUTTON_CLASS } from "@/components/classes";
import { EditIcon } from "@/components/edit-icon";
import { PROFILE_LINK_CLASS, ProfileTable } from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import type { CertificationRecord } from "@/lib/certifications";
import { formatLicenceDate } from "@/lib/state-licenses";

/*
 * The rows of one side's certifications: an agent's (leading column the
 * policy type) or a policy type's (leading column the agent, linked to their
 * profile), then Start, End, Document (the PDF's name, linking to its
 * download through ./[id]/file), Verified and Status. Every row starts with an
 * Edit button.
 * Dates are formatted from the stored string, never through Date, so the
 * server and the browser agree. The caller wraps it in a Panel or a table's
 * details row and shows its own empty state.
 */

type CertificationsTableProps = {
  certifications: CertificationRecord[];
  /** Which side the rows are listed under: the other is the leading column. */
  leading: "policyType" | "agent";
  onEdit: (certification: CertificationRecord) => void;
};

/** A date cell: the formatted date, or "—" when unset. */
function DateCell({ date }: { date: string }) {
  return (
    <td className="whitespace-nowrap px-3 py-2.5 align-middle text-fg-muted">
      {date ? <time dateTime={date}>{formatLicenceDate(date)}</time> : <span className="text-fg-subtle">—</span>}
    </td>
  );
}

/** The PDF's name linking to its download, or "—" when there is none. */
function DocumentCell({ certification }: { certification: CertificationRecord }) {
  return (
    <td className="min-w-0 truncate px-3 py-2.5 align-middle sm:whitespace-nowrap">
      {certification.fileName ? (
        // A plain link, not <Link>: it is a file download, not a page.
        <a href={`/certifications/${encodeURIComponent(certification.id)}/file`} className={PROFILE_LINK_CLASS}>
          {certification.fileName}
        </a>
      ) : (
        <span className="text-fg-subtle">—</span>
      )}
    </td>
  );
}

export function CertificationsTable({ certifications, leading, onEdit }: CertificationsTableProps) {
  const columns = ["Action", leading === "agent" ? "Agent" : "Policy type", "Start", "End", "Document", "Verified", "Status"];

  return (
    <ProfileTable columns={columns} rows={certifications} rowKey={(certification) => certification.id}>
      {(certification) => (
        <>
          <td className="w-16 whitespace-nowrap px-3 py-1.5 align-middle">
            <button
              type="button"
              onClick={() => onEdit(certification)}
              aria-label={`Edit the ${certification.policyTypeName} certification for ${certification.agentName}`}
              title="Edit"
              className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
            >
              <EditIcon className="size-3.5 shrink-0" />
            </button>
          </td>
          <td className="min-w-0 truncate px-3 py-2.5 align-middle sm:whitespace-nowrap">
            {leading === "agent" ? (
              <Link href={`/agents/${certification.agentId}`} className={PROFILE_LINK_CLASS}>
                {certification.agentName}
              </Link>
            ) : (
              <span className="font-medium text-fg">{certification.policyTypeName}</span>
            )}
          </td>
          <DateCell date={certification.startDate} />
          <DateCell date={certification.endDate} />
          <DocumentCell certification={certification} />
          <td className="whitespace-nowrap px-3 py-2.5 align-middle text-fg-muted">
            {certification.isVerified ? "Yes" : "No"}
          </td>
          <td className="px-3 py-2.5 align-middle">
            <StatusBadge status={certification.status} />
          </td>
        </>
      )}
    </ProfileTable>
  );
}
