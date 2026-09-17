import Link from "next/link";
import { useId, type ReactNode } from "react";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * Shared pieces of an entity's profile page (agent, carrier): the back link,
 * the initials avatar beside the name, the "label  value" rows of the header
 * card, and the titled panels holding related lists. Each profile lays these
 * out itself. No state here, so both server and client profiles can use them.
 */

export const PROFILE_LINK_CLASS = "font-medium text-fg hover:text-brand-ink hover:underline";

export const PROFILE_LABEL_CLASS = "text-xs font-medium text-fg-subtle";

/** Header cell of a panel's small table. */
export const PROFILE_TH_CLASS = `whitespace-nowrap px-3 py-2 ${PROFILE_LABEL_CLASS}`;

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

/** "Maria Alva" → "MA"; a single word gives one letter. */
export function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((word) => word[0].toUpperCase()).join("");
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
