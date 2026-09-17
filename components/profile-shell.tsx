import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/status-badge";

/*
 * Read-only layout for one entity's profile page: a back link, the title with
 * its status, an identity grid of key–value pairs, then stacked sections for
 * related lists. Server-safe; pass client pieces in as children.
 */

type ProfileShellProps = {
  back: { href: string; label: string };
  title: string;
  status: "active" | "pending" | "inactive";
  subtitle?: ReactNode;
  /** Shown to the right of the back link, e.g. a switcher. */
  actions?: ReactNode;
  /** Key–value pairs shown under the title. An empty value shows "—". */
  identity: { label: string; value: ReactNode }[];
  children: ReactNode;
};

export function ProfileShell({ back, title, status, subtitle, actions, identity, children }: ProfileShellProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={back.href}
          className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-gray-600 hover:bg-brand-soft hover:text-brand-ink"
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
          {back.label}
        </Link>
        {actions}
      </div>

      <header className="mt-3 mb-6 border-b border-line pb-4">
        <div aria-hidden="true" className="bg-brand-gradient mb-3 h-1 w-10 rounded-full" />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          <StatusBadge status={status} />
        </div>
        {subtitle ? <p className="mt-1 text-sm text-gray-600">{subtitle}</p> : null}

        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {identity.map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
              <dd className="mt-1 break-words text-sm text-gray-900">
                {value === "" || value === null || value === undefined ? (
                  <span className="text-gray-500">—</span>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="space-y-8">{children}</div>
    </>
  );
}

type ProfileSectionProps = {
  title: string;
  /** Shown as a pill beside the title. */
  count?: number;
  /** When set and count is 0, this one quiet line replaces the children. */
  emptyMessage?: string;
  children?: ReactNode;
};

export function ProfileSection({ title, count, emptyMessage, children }: ProfileSectionProps) {
  const empty = emptyMessage !== undefined && count === 0;

  return (
    <section>
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
        {count !== undefined ? (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium normal-case tracking-normal tabular-nums text-brand-ink">
            {count}
          </span>
        ) : null}
      </h2>
      {empty ? <p className="mt-2 text-sm text-gray-500">{emptyMessage}</p> : <div className="mt-2">{children}</div>}
    </section>
  );
}
