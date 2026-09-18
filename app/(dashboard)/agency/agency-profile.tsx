"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import { EditIcon } from "@/components/edit-icon";
import { LicenseNumber } from "@/components/license-number";
import { NoteList } from "@/components/note-list";
import {
  Count,
  Detail,
  Panel,
  PanelEmpty,
  PROFILE_LINK_CLASS as LINK_CLASS,
  PROFILE_TH_CLASS as TH_CLASS,
  ProfileAvatar,
  StateChip,
} from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import type { AgencyNote, AgencyRecord } from "@/lib/agency";
import type { AgentRecord } from "@/lib/agents";
import { US_STATE_NAMES } from "@/lib/us-states";
import {
  AGENCY_FIELD_LABELS,
  AgencyDialog,
  saveAgency,
  type AgencyError,
  type AgencyValues,
} from "./agency-dialog";

/*
 * Profile for the agency: the one org record for this shop, laid out like an
 * agent's profile. The name row (initials, name, status, Edit) sits above one
 * header card with the contact details and the agency's licensed states, one
 * small card per state with its licence number. Below, two panels: Agents —
 * everyone under the shop, linking to their profiles (agents are still edited
 * on Agents) — beside Notes, the agency's change log.
 *
 * Edit opens AgencyDialog, the agent form with org labels. It is all dummy:
 * the agency and notes live in component state, and a refresh brings back the
 * JSON. No back link: there is no agency list to go back to.
 */

type AgentRow = Pick<AgentRecord, "id" | "name" | "status" | "licensedStates">;

type AgencyProfileProps = {
  initialAgency: AgencyRecord;
  initialNotes: AgencyNote[];
  /** Every agent, sorted by name. */
  agents: AgentRow[];
};

const AGENT_COLUMNS = ["Agent", "Licensed states", "Status"];

/** Soft brand fill, so it reads as the one action of its row rather than as row text. */
const PANEL_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md bg-brand-soft px-2.5 py-1 text-sm font-medium text-brand-ink shadow-sm hover:bg-brand-strong hover:text-white";

const subscribe = () => () => {};

/** NoteList formats timestamps in the browser's time zone, so it renders only after hydration. */
function AgencyNotes({ notes }: { notes: AgencyNote[] }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!hydrated) return <p className="text-sm text-fg-subtle">Loading notes…</p>;
  return <NoteList notes={notes} labels={AGENCY_FIELD_LABELS} />;
}

export function AgencyProfile({ initialAgency, initialNotes, agents }: AgencyProfileProps) {
  const [agency, setAgency] = useState(initialAgency);
  const [notes, setNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editing, setEditing] = useState<AgencyRecord | null>(null);
  const licensedHeadingId = useId();

  /** Edits the agency. Returns the dialog's error, if any. */
  const saveEdit = (values: AgencyValues): AgencyError | null => {
    const result = saveAgency({ notes, values, editing: agency });
    if (result.error !== null) return result.error;
    if (!result.changed) return null;

    setAgency(result.agency);
    setNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    return null;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <ProfileAvatar name={agency.name} />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Agency</p>
            <h1 className="text-xl font-semibold tracking-tight text-fg">{agency.name}</h1>
            <div className="mt-0.5 flex">
              <StatusBadge status={agency.status} />
            </div>
          </div>
        </div>
        <button type="button" onClick={() => setEditing(agency)} className={PANEL_BUTTON_CLASS}>
          <EditIcon className="size-3.5 shrink-0" />
          Edit<span className="sr-only"> {agency.name}</span>
        </button>
      </div>

      <header className="mt-4 grid overflow-hidden rounded-xl border border-line bg-surface p-2 shadow-sm lg:grid-cols-[auto_minmax(0,1fr)]">
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] content-start items-baseline gap-x-6 gap-y-3 px-5 py-4 lg:max-w-md">
          <Detail label="NPN">
            {agency.npn ? <span className="font-mono">{agency.npn}</span> : null}
          </Detail>
          <Detail label="Email">
            {agency.email ? (
              <a href={`mailto:${agency.email}`} className="hover:text-brand-ink hover:underline">
                {agency.email}
              </a>
            ) : null}
          </Detail>
          <Detail label="Phone">
            {agency.phone ? (
              <a href={`tel:${agency.phone}`} className="hover:text-brand-ink hover:underline">
                {agency.phone}
              </a>
            ) : null}
          </Detail>
          <Detail label="Other names">{agency.aliases.join(", ")}</Detail>
        </dl>

        <section
          aria-labelledby={licensedHeadingId}
          className="min-w-0 border-t border-line px-5 py-4 lg:border-l lg:border-t-0"
        >
          <h2
            id={licensedHeadingId}
            title="The agency's own licences."
            className="flex items-center gap-2 text-sm font-semibold text-fg"
          >
            Licensed states
            <Count value={agency.licensedStates.length} />
          </h2>

          {agency.licensedStates.length === 0 ? (
            <p className="mt-2 text-sm text-fg-subtle">No agency licences recorded yet.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
              {agency.licensedStates.map((code) => (
                <li
                  key={code}
                  title={US_STATE_NAMES[code]}
                  className="flex items-baseline justify-between rounded-lg bg-surface-muted px-3 py-2 ring-1 ring-inset ring-line"
                >
                  <span className="font-mono text-sm font-bold text-fg">
                    {code}
                    {US_STATE_NAMES[code] ? (
                      <span className="sr-only"> ({US_STATE_NAMES[code]})</span>
                    ) : null}
                  </span>
                  <LicenseNumber value={agency.licenseNumbers[code]} className="min-w-0" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </header>

      <div role="status">
        {unsavedCount > 0 ? (
          <p className="mt-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            {unsavedCount === 1 ? "1 change" : `${unsavedCount} changes`} made on this page only.
            Nothing is saved yet, so refreshing undoes {unsavedCount === 1 ? "it" : "them"}.
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        <Panel
          title="Agents"
          count={agents.length}
          action={
            <Link href="/agents" className="text-xs font-medium text-brand-ink hover:underline">
              Manage on Agents<span aria-hidden="true"> →</span>
            </Link>
          }
        >
          {agents.length === 0 ? (
            <PanelEmpty>No agents yet. Add them on the Agents page.</PanelEmpty>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-muted">
                  <tr>
                    {AGENT_COLUMNS.map((heading) => (
                      <th key={heading} scope="col" className={TH_CLASS}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line border-t border-line">
                  {agents.map((agent) => (
                    <tr key={agent.id}>
                      <td className="px-3 py-2.5 align-middle sm:whitespace-nowrap">
                        <Link href={`/agents/${agent.id}`} className={LINK_CLASS}>
                          {agent.name}
                        </Link>
                      </td>
                      <td className="w-full px-3 py-2.5">
                        {agent.licensedStates.length > 0 ? (
                          <ul
                            aria-label={`States ${agent.name} is licensed in`}
                            className="flex flex-wrap gap-1"
                          >
                            {agent.licensedStates.map((code) => (
                              <StateChip key={code} code={code} />
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-fg-faint">No licences yet</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={agent.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Notes" count={notes.length}>
          {/* Cancels NoteList's own top margin; the panel body already pads. */}
          <div className="-mt-2">
            <AgencyNotes notes={notes} />
          </div>
        </Panel>
      </div>

      <AgencyDialog editing={editing} onSave={saveEdit} onClose={() => setEditing(null)} />
    </div>
  );
}
