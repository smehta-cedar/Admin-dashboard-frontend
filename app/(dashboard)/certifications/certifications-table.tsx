"use client";

import { ROW_BUTTON_CLASS } from "@/components/classes";
import { EditIcon } from "@/components/edit-icon";
import { PROFILE_LINK_CLASS, ProfileTable } from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import type { CertificationRecord } from "@/lib/certifications";
import { formatLicenceDate } from "@/lib/state-licenses";

/*
 * One agent's certifications: Carrier, Line of business (the sub type), Due,
 * Completion, Expiry, Document (the PDF's name, linking to its download
 * through ./[id]/file), Verified and Status; "—" for anything unset. With onEdit every row
 * starts with an Edit button; without it (an agent's own read-only profile)
 * there is no Action column. fileLinks false shows the PDF's name unlinked.
 * Dates are formatted from the stored string, never through Date, so the
 * server and the browser agree. The caller wraps it in a Panel or a table's
 * details row and shows its own empty state.
 */

type CertificationsTableProps = {
  certifications: CertificationRecord[];
  onEdit?: (certification: CertificationRecord) => void;
  /** Whether the PDF's name links to its download. */
  fileLinks?: boolean;
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
function DocumentCell({ certification, link }: { certification: CertificationRecord; link: boolean }) {
  return (
    <td className="min-w-0 truncate px-3 py-2.5 align-middle sm:whitespace-nowrap">
      {certification.fileName && !link ? (
        certification.fileName
      ) : certification.fileName ? (
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

/** A text cell: the value, or "—" when blank. */
function TextCell({ text, strong = false }: { text: string; strong?: boolean }) {
  return (
    <td className="min-w-0 truncate px-3 py-2.5 align-middle sm:whitespace-nowrap">
      {text ? (
        <span className={strong ? "font-medium text-fg" : "text-fg-muted"}>{text}</span>
      ) : (
        <span className="text-fg-subtle">—</span>
      )}
    </td>
  );
}

/** List order: due date (unset last), then carrier name, then line of business. */
export function compareCertifications(a: CertificationRecord, b: CertificationRecord): number {
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }
  return a.carrierName.localeCompare(b.carrierName) || a.lineOfBusiness.localeCompare(b.lineOfBusiness);
}

/**
 * `certifications` split by the year they are due, newest year first, each
 * in list order; rows with no due date come last under year "".
 */
export function certificationsByYear(
  certifications: CertificationRecord[],
): { year: string; certifications: CertificationRecord[] }[] {
  const groups = new Map<string, CertificationRecord[]>();
  for (const certification of [...certifications].sort(compareCertifications)) {
    const year = certification.dueDate.slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), certification]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : b.localeCompare(a)))
    .map(([year, rows]) => ({ year, certifications: rows }));
}

/** What a row is called in labels, e.g. "Humana MAPD". */
export function certificationLabel(certification: CertificationRecord): string {
  return [certification.carrierName, certification.lineOfBusiness].filter(Boolean).join(" ") || "untitled";
}

export function CertificationsTable({ certifications, onEdit, fileLinks = true }: CertificationsTableProps) {
  const columns = [
    ...(onEdit ? ["Action"] : []),
    "Carrier",
    "Line of business",
    "Due Date",
    "Completion Date",
    "Expiry Date",
    "Document",
    "Verified",
    "Status",
  ];

  return (
    <ProfileTable columns={columns} rows={certifications} rowKey={(certification) => certification.id}>
      {(certification) => (
        <>
          {onEdit ? (
            <td className="w-16 whitespace-nowrap px-3 py-1.5 align-middle">
              <button
                type="button"
                onClick={() => onEdit(certification)}
                aria-label={`Edit the ${certificationLabel(certification)} certification`}
                title="Edit"
                className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
              >
                <EditIcon className="size-3.5 shrink-0" />
              </button>
            </td>
          ) : null}
          <TextCell text={certification.carrierName} strong />
          <TextCell text={certification.lineOfBusiness} />
          <DateCell date={certification.dueDate} />
          <DateCell date={certification.startDate} />
          <DateCell date={certification.endDate} />
          <DocumentCell certification={certification} link={fileLinks} />
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
