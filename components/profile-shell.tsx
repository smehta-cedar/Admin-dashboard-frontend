"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { CredentialValue } from "@/components/credential-value";
import { EditIcon } from "@/components/edit-icon";
import { LicenseNumber } from "@/components/license-number";
import { StatusBadge } from "@/components/status-badge";
import { TablePagination, useTablePagination } from "@/components/table-pagination";
import type { LoginRecord } from "@/lib/logins";
import { US_STATE_NAMES } from "@/lib/us-states";
import { initials } from "@/lib/text";

/*
 * Shared pieces of an entity's profile page (agent, carrier, agency), top to
 * bottom: the back link, the name row (initials avatar, name, status, Edit),
 * the header card (the "label  value" rows beside one titled aside, e.g.
 * licensed states as licence cards), and the titled panels holding related
 * lists — a small table (`ProfileTable`, with `StateChipCell` for a states
 * column) and the Logins panel both agent and carrier profiles show. Each
 * profile lays these out itself. Profile pages that use these are client
 * components; `ProfileTable` paginates through `table-pagination`.
 */

export const PROFILE_LINK_CLASS = "font-medium text-fg hover:text-brand-ink hover:underline";

export const PROFILE_LABEL_CLASS = "text-xs font-medium text-fg-subtle";

/** Header cell of a panel's small table. */
export const PROFILE_TH_CLASS = `whitespace-nowrap px-3 py-2 ${PROFILE_LABEL_CLASS}`;

/** Soft brand fill, so a profile action (Edit, "+ Add carrier") reads as the one action of its row rather than as row text. */
export const PROFILE_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md bg-brand-soft px-2.5 py-1 text-sm font-medium text-brand-ink shadow-sm hover:bg-brand-strong hover:text-white";

/** The "‹ Agents" link at the top of a profile, back to the entity's list. */
export function ProfileBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-fg-muted hover:bg-brand-soft hover:text-brand-ink"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5l-5 5 5 5" />
      </svg>
      {label}
    </Link>
  );
}

/** The round initials badge that sits beside a profile's name. */
export function ProfileAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-base font-semibold text-brand-ink"
    >
      {initials(name)}
    </span>
  );
}

type ProfileNameRowProps = {
  name: string;
  status: "active" | "inactive";
  /** Small caps line over the name, e.g. "Agency". */
  eyebrow?: string;
  /** Opens the entity's edit dialog. */
  onEdit: () => void;
  /** Margin above: `mt-4` under a back-link row, none when the row is first. */
  className?: string;
};

/** The name row: avatar, name with its status badge, and Edit on the right. */
export function ProfileNameRow({ name, status, eyebrow, onEdit, className = "mt-4" }: ProfileNameRowProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-3.5">
        <ProfileAvatar name={name} />
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{eyebrow}</p>
          ) : null}
          <h1 className="text-xl font-semibold tracking-tight text-fg">{name}</h1>
          <div className="mt-0.5 flex">
            <StatusBadge status={status} />
          </div>
        </div>
      </div>
      <button type="button" onClick={onEdit} className={PROFILE_BUTTON_CLASS}>
        <EditIcon className="size-3.5 shrink-0" />
        Edit<span className="sr-only"> {name}</span>
      </button>
    </div>
  );
}

type ProfileHeaderProps = {
  /** `Detail` rows for the left column. */
  details: ReactNode;
  /** The aside's heading, count pill and tooltip, e.g. "Licensed states". */
  asideTitle: string;
  asideCount: number;
  asideTooltip: string;
  /** The aside's body: a chip list, `LicenseCards`, or an empty-state line. */
  children: ReactNode;
};

/** The header card: contact details beside one titled aside. Stacks below `lg`. */
export function ProfileHeader({
  details,
  asideTitle,
  asideCount,
  asideTooltip,
  children,
}: ProfileHeaderProps) {
  const headingId = useId();

  return (
    <header className="mt-4 grid overflow-hidden rounded-xl border border-line bg-surface p-2 shadow-sm lg:grid-cols-[auto_minmax(0,1fr)]">
      <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] content-start items-baseline gap-x-6 gap-y-3 px-5 py-4 lg:max-w-md">
        {details}
      </dl>

      <section
        aria-labelledby={headingId}
        className="min-w-0 border-t border-line px-5 py-4 lg:border-l lg:border-t-0"
      >
        <h2
          id={headingId}
          title={asideTooltip}
          className="flex items-center gap-2 text-sm font-semibold text-fg"
        >
          {asideTitle}
          <Count value={asideCount} />
        </h2>
        {children}
      </section>
    </header>
  );
}

type ProducerDetailsProps = {
  npn: string;
  email: string;
  phone: string;
  aliases: string[];
  /** "Aliases" for an agent, "Other names" for the agency. */
  aliasesLabel: string;
};

/** The NPN / email / phone / aliases rows an agent and the agency both show. */
export function ProducerDetails({ npn, email, phone, aliases, aliasesLabel }: ProducerDetailsProps) {
  return (
    <>
      <Detail label="NPN">{npn ? <span className="font-mono">{npn}</span> : null}</Detail>
      <Detail label="Email">
        {email ? (
          <a href={`mailto:${email}`} className="hover:text-brand-ink hover:underline">
            {email}
          </a>
        ) : null}
      </Detail>
      <Detail label="Phone">
        {phone ? (
          <a href={`tel:${phone}`} className="hover:text-brand-ink hover:underline">
            {phone}
          </a>
        ) : null}
      </Detail>
      <Detail label={aliasesLabel}>{aliases.join(", ")}</Detail>
    </>
  );
}

type LicenseCardsProps = {
  /** Licensed state codes, in code order. */
  codes: string[];
  /** Licence number by state code; a missing one shows "No number yet". */
  numbers: Record<string, string>;
  /** Shown instead of the cards when `codes` is empty. */
  empty: string;
};

/** One small card per licensed state: the code beside that state's licence number. */
export function LicenseCards({ codes, numbers, empty }: LicenseCardsProps) {
  if (codes.length === 0) return <p className="mt-2 text-sm text-fg-subtle">{empty}</p>;

  return (
    <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
      {codes.map((code) => (
        <li
          key={code}
          title={US_STATE_NAMES[code]}
          className="flex items-baseline justify-between rounded-lg bg-surface-muted px-3 py-2 ring-1 ring-inset ring-line"
        >
          <span className="font-mono text-sm font-bold text-fg">
            {code}
            {US_STATE_NAMES[code] ? <span className="sr-only"> ({US_STATE_NAMES[code]})</span> : null}
          </span>
          <LicenseNumber value={numbers[code]} className="min-w-0" />
        </li>
      ))}
    </ul>
  );
}

/** A state code chip, with the full name on hover and for screen readers. */
export function StateChip({ code }: { code: string }) {
  return (
    <li
      title={US_STATE_NAMES[code]}
      className="rounded-md bg-surface-muted px-2 py-1 font-mono text-xs font-medium text-fg-muted ring-1 ring-inset ring-line"
    >
      {code}
      {US_STATE_NAMES[code] ? <span className="sr-only"> ({US_STATE_NAMES[code]})</span> : null}
    </li>
  );
}

/** The count pill beside a heading. */
export function Count({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium tabular-nums text-brand-ink">
      {value}
    </span>
  );
}

/** One "label  value" row on the header card; the parent grid lines the values up. An empty value shows "—". */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className={PROFILE_LABEL_CLASS}>{label}</dt>
      <dd className="min-w-0 break-words text-sm text-fg">
        {children || <span className="text-fg-subtle">—</span>}
      </dd>
    </div>
  );
}

type PanelProps = {
  title: string;
  count: number;
  /** Shown at the end of the title row, e.g. an Add button. */
  action?: ReactNode;
  /** Extra classes on the card, e.g. a column span. */
  className?: string;
  children: ReactNode;
};

/** A titled card holding one related list, inset from the card's edges by the body padding. */
export function Panel({ title, count, action, className = "", children }: PanelProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={`min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-sm ${className}`}
    >
      <div className="flex min-h-13 items-center justify-between gap-3 border-b border-line px-5 py-2.5">
        <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-fg">
          {title}
          <Count value={count} />
        </h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** What a panel shows instead of its list when there is nothing in it. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-fg-subtle">{children}</p>;
}

type ProfileTableProps<T> = {
  /** Column headings, in order. */
  columns: string[];
  rows: T[];
  rowKey: (row: T) => string;
  /** The `<td>`s of one row, in column order. */
  children: (row: T) => ReactNode;
};

/**
 * A panel's small table: headings row, then one `<tr>` per row. Paginates when
 * there are more than 5 rows — default page size 5, with 10 and 20 options.
 * `table-fixed` keeps columns evenly spaced; the caller renders the cells.
 */
export function ProfileTable<T>({ columns, rows, rowKey, children }: ProfileTableProps<T>) {
  const { pageItems, start, pageSize, setPageSize, currentPage, pageCount, setPage } =
    useTablePagination(rows);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-surface-muted">
            <tr>
              {columns.map((heading) => (
                <th key={heading} scope="col" className={PROFILE_TH_CLASS}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {pageItems.map((row) => (
              <tr key={rowKey(row)}>{children(row)}</tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination
        start={start}
        pageLength={pageItems.length}
        total={rows.length}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        currentPage={currentPage}
        pageCount={pageCount}
        onPageChange={setPage}
      />
    </div>
  );
}

type StateChipCellProps = {
  codes: string[];
  /** The list's accessible name, e.g. "States writable with Humana". */
  label: string;
  /** Shown when `codes` is empty. */
  empty: string;
};

/** A states column cell: chips, or a faint empty-state line. */
export function StateChipCell({ codes, label, empty }: StateChipCellProps) {
  return (
    <td className="min-w-0 px-3 py-2.5 align-middle">
      {codes.length > 0 ? (
        <ul aria-label={label} className="flex flex-wrap gap-1">
          {codes.map((code) => (
            <StateChip key={code} code={code} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-fg-faint">{empty}</p>
      )}
    </td>
  );
}

/** A login row on a profile, with the other party (carrier or agent) resolved to a link. */
export type ProfileLogin = LoginRecord & { partyName: string; partyHref: string };

type LoginsPanelProps = {
  /** Sorted by party name. */
  logins: ProfileLogin[];
  /** Heading of the first column: "Carrier" on an agent, "Agent" on a carrier. */
  partyHeading: string;
  /** Extra classes on the panel, e.g. a column span. */
  className?: string;
};

/** The Logins panel: the other party, portal username, password and status. */
export function LoginsPanel({ logins, partyHeading, className }: LoginsPanelProps) {
  return (
    <Panel title="Logins" count={logins.length} className={className}>
      {logins.length === 0 ? (
        <PanelEmpty>No logins recorded.</PanelEmpty>
      ) : (
        <ProfileTable
          columns={[partyHeading, "Portal username", "Password", "Status"]}
          rows={logins}
          rowKey={(login) => login.id}
        >
          {(login) => (
            <>
              <td className="min-w-24 whitespace-nowrap px-3 py-2.5">
                <Link href={login.partyHref} className={PROFILE_LINK_CLASS}>
                  {login.partyName}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-fg-muted">
                <CredentialValue value={login.username} label="username" />
              </td>
              <td className="px-3 py-2.5 text-fg-muted">
                <CredentialValue value={login.portalPassword} label="password" secret />
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={login.status} />
              </td>
            </>
          )}
        </ProfileTable>
      )}
    </Panel>
  );
}
