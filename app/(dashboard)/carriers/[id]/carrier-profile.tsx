"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { EditIcon } from "@/components/edit-icon";
import {
  Count,
  Detail,
  Panel,
  PanelEmpty,
  PROFILE_LINK_CLASS as LINK_CLASS,
  PROFILE_TH_CLASS as TH_CLASS,
  ProfileAvatar,
  ProfileBackLink,
  StateChip,
} from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import type { AgentStatus } from "@/lib/agents";
import type { CarrierNote, CarrierRecord } from "@/lib/carriers";
import type { LoginRecord } from "@/lib/logins";
import { writableStates } from "@/lib/us-states";
import { CredentialValue } from "../../logins/credential-value";
import {
  CarrierDialog,
  saveCarrier,
  type CarrierEditor,
  type CarrierError,
  type CarrierValues,
} from "../carrier-dialog";
import { CarrierNotes } from "./carrier-notes";
import { CarrierSwitcher } from "./carrier-switcher";

/*
 * Profile for one carrier: identity (including the states it is available in,
 * one ceiling on its appointments), then everything linked to it — contracted
 * agents, logins, and change notes. An agent row shows the states they can
 * actually write here: their appointment narrowed to their own licences
 * (Agents) and this carrier's footprint. Edit opens the same CarrierDialog as
 * the Carriers list. Agent names link to their profiles.
 *
 * Same layout as the agent profile, built from the shared pieces in
 * components/profile-shell.tsx: the name row (initials, name, status, Edit)
 * over one header card holding the carrier's details beside its available
 * states, then panels: Agents beside Notes, and Logins full width under them.
 *
 * Dummy like the rest: the carrier and notes live in component state, and a
 * refresh brings back the JSON. page.tsx keys this component by carrier ID, so
 * switching carriers starts that state again.
 */

type AgentRow = {
  id: string;
  name: string;
  status: AgentStatus;
  /** Raw appointment states; writable is derived against the live footprint. */
  appointedStates: string[];
  licensedStates: string[];
};

type CarrierProfileProps = {
  initialCarrier: CarrierRecord;
  /** Every carrier: the switcher's options and the name uniqueness check. */
  allCarriers: CarrierRecord[];
  /** Contracted agents, sorted by name. */
  agents: AgentRow[];
  /** Sorted by agent name. */
  logins: (LoginRecord & { agentName: string })[];
  /** Every carrier's notes, newest first: new note IDs need them all. Only this carrier's are shown. */
  initialNotes: CarrierNote[];
};

const AGENT_COLUMNS = ["Agent", "Writable states", "Status"];

const LOGIN_COLUMNS = ["Agent", "Writing number", "Portal username", "Password", "Status"];

/** Soft brand fill, so it reads as the one action of its row rather than as row text. */
const PANEL_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md bg-brand-soft px-2.5 py-1 text-sm font-medium text-brand-ink shadow-sm hover:bg-brand-strong hover:text-white";

export function CarrierProfile({
  initialCarrier,
  allCarriers: initialAllCarriers,
  agents,
  logins,
  initialNotes,
}: CarrierProfileProps) {
  const [carrier, setCarrier] = useState(initialCarrier);
  const [carriers, setCarriers] = useState(initialAllCarriers);
  const [allNotes, setAllNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<CarrierEditor | null>(null);
  const availableHeadingId = useId();

  // An edit here shows at once in the switcher too.
  const switcherCarriers = carriers
    .map((other) => (other.id === carrier.id ? carrier : other))
    .map(({ id, name, status }) => ({ id, name, status }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const notes = allNotes.filter((note) => note.carrierId === carrier.id);

  // Writable is what the appointment actually buys them: its states within
  // this agent's licences and this carrier's live footprint.
  const agentRows = agents.map((agent) => ({
    ...agent,
    writable: writableStates(agent.appointedStates, agent.licensedStates, carrier.availableStates),
  }));

  /** Edits this carrier. Returns the dialog's errors, if any. */
  const saveCarrierEdit = (values: CarrierValues): CarrierError[] => {
    const result = saveCarrier({
      carriers: carriers.map((other) => (other.id === carrier.id ? carrier : other)),
      notes: allNotes,
      values,
      editing: carrier,
    });
    if (result.carrier === null) return result.errors;
    if (!result.changed) return [];

    setCarrier(result.carrier);
    setCarriers(result.carriers);
    setAllNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    return [];
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProfileBackLink href="/carriers" label="Carriers" />
        <CarrierSwitcher currentId={carrier.id} carriers={switcherCarriers} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <ProfileAvatar name={carrier.name} />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-fg">{carrier.name}</h1>
            <div className="mt-0.5 flex">
              <StatusBadge status={carrier.status} />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditor({ mode: "edit", carrier })}
          className={PANEL_BUTTON_CLASS}
        >
          <EditIcon className="size-3.5 shrink-0" />
          Edit<span className="sr-only"> {carrier.name}</span>
        </button>
      </div>

      <header className="mt-4 grid overflow-hidden rounded-xl border border-line bg-surface p-2 shadow-sm lg:grid-cols-[auto_minmax(0,1fr)]">
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] content-start items-baseline gap-x-6 gap-y-3 px-5 py-4 lg:max-w-md">
          <Detail label="Carrier ID">
            <span className="font-mono">#{carrier.id}</span>
          </Detail>
          <Detail label="Aliases">{carrier.aliases.join(", ")}</Detail>
          <Detail label="Lines of business">
            {carrier.linesOfBusiness.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {carrier.linesOfBusiness.map((line) => (
                  <li
                    key={line}
                    className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-ink"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
          </Detail>
        </dl>

        <section
          aria-labelledby={availableHeadingId}
          className="min-w-0 border-t border-line px-5 py-4 lg:border-l lg:border-t-0"
        >
          <h2
            id={availableHeadingId}
            title="Where this carrier is available for the agency."
            className="flex items-center gap-2 text-sm font-semibold text-fg"
          >
            Available states
            <Count value={carrier.availableStates.length} />
          </h2>

          {carrier.availableStates.length === 0 ? (
            <p className="mt-2 text-sm text-fg-subtle">
              No states recorded, so no agent can write with this carrier yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {carrier.availableStates.map((code) => (
                <StateChip key={code} code={code} />
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
        <Panel title="Agents" count={agentRows.length}>
          {agentRows.length === 0 ? (
            <PanelEmpty>No contracted agents.</PanelEmpty>
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
                  {agentRows.map((agent) => (
                    <tr key={agent.id}>
                      <td className="px-3 py-2.5 align-middle sm:whitespace-nowrap">
                        <Link href={`/agents/${agent.id}`} className={LINK_CLASS}>
                          {agent.name}
                        </Link>
                      </td>
                      <td className="w-full px-3 py-2.5">
                        {agent.writable.length > 0 ? (
                          <ul
                            aria-label={`States ${agent.name} can write here`}
                            className="flex flex-wrap gap-1"
                          >
                            {agent.writable.map((code) => (
                              <StateChip key={code} code={code} />
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-fg-faint">No states yet</p>
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
            <CarrierNotes notes={notes} />
          </div>
        </Panel>

        <Panel title="Logins" count={logins.length} className="xl:col-span-2">
          {logins.length === 0 ? (
            <PanelEmpty>No logins recorded.</PanelEmpty>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-muted">
                  <tr>
                    {LOGIN_COLUMNS.map((heading) => (
                      <th key={heading} scope="col" className={TH_CLASS}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line border-t border-line">
                  {logins.map((login) => (
                    <tr key={login.id}>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <Link href={`/agents/${login.agentId}`} className={LINK_CLASS}>
                          {login.agentName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-fg-muted">
                        {login.writingNumber}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <CarrierDialog editor={editor} onSave={saveCarrierEdit} onClose={() => setEditor(null)} />
    </div>
  );
}
