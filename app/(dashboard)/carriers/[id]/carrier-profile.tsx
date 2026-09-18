"use client";

import Link from "next/link";
import { useState } from "react";
import { EntitySwitcher } from "@/components/entity-switcher";
import { HydratedNoteList } from "@/components/hydrated-note-list";
import {
  Detail,
  LoginsPanel,
  Panel,
  PanelEmpty,
  PROFILE_LINK_CLASS,
  ProfileBackLink,
  ProfileHeader,
  ProfileNameRow,
  ProfileTable,
  StateChip,
  StateChipCell,
  type ProfileLogin,
} from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import { UnsavedBanner } from "@/components/unsaved-banner";
import type { AgentStatus } from "@/lib/agents";
import type { CarrierNote, CarrierRecord } from "@/lib/carriers";
import { writableStates } from "@/lib/us-states";
import {
  CARRIER_FIELD_LABELS,
  CarrierDialog,
  saveCarrier,
  type CarrierEditor,
  type CarrierError,
  type CarrierValues,
} from "../carrier-dialog";

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
  writingNumber: string;
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
  /** This carrier's logins, the agent as the party, sorted by agent name. */
  logins: ProfileLogin[];
  /** Every carrier's notes, newest first: new note IDs need them all. Only this carrier's are shown. */
  initialNotes: CarrierNote[];
};

const AGENT_COLUMNS = ["Agent", "Writing number", "Writable states", "Status"];

export function CarrierProfile({
  initialCarrier,
  allCarriers,
  agents,
  logins,
  initialNotes,
}: CarrierProfileProps) {
  const [carrier, setCarrier] = useState(initialCarrier);
  const [allNotes, setAllNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<CarrierEditor | null>(null);

  // An edit here shows at once in the switcher and the uniqueness check too.
  const carriers = allCarriers.map((other) => (other.id === carrier.id ? carrier : other));
  const notes = allNotes.filter((note) => note.carrierId === carrier.id);

  // Writable is what the appointment actually buys them: its states within
  // this agent's licences and this carrier's live footprint.
  const agentRows = agents.map((agent) => ({
    ...agent,
    writable: writableStates(agent.appointedStates, agent.licensedStates, carrier.availableStates),
  }));

  /** Edits this carrier. Returns the dialog's errors, if any. */
  const saveCarrierEdit = (values: CarrierValues): CarrierError[] => {
    const result = saveCarrier({ carriers, notes: allNotes, values, editing: carrier });
    if (result.carrier === null) return result.errors;
    if (!result.changed) return [];

    setCarrier(result.carrier);
    setAllNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    return [];
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProfileBackLink href="/carriers" label="Carriers" />
        <EntitySwitcher
          label="Switch carrier"
          currentId={carrier.id}
          options={carriers}
          hrefFor={(id) => `/carriers/${id}`}
        />
      </div>

      <ProfileNameRow
        name={carrier.name}
        status={carrier.status}
        onEdit={() => setEditor({ mode: "edit", carrier })}
      />

      <ProfileHeader
        details={
          <>
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
          </>
        }
        asideTitle="Available states"
        asideCount={carrier.availableStates.length}
        asideTooltip="Where this carrier is available for the agency."
      >
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
      </ProfileHeader>

      <UnsavedBanner count={unsavedCount} className="mt-4" />

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        <Panel title="Agents" count={agentRows.length}>
          {agentRows.length === 0 ? (
            <PanelEmpty>No contracted agents.</PanelEmpty>
          ) : (
            <ProfileTable columns={AGENT_COLUMNS} rows={agentRows} rowKey={(agent) => agent.id}>
              {(agent) => (
                <>
                  <td className="min-w-0 truncate px-3 py-2.5 align-middle sm:whitespace-nowrap">
                    <Link href={`/agents/${agent.id}`} className={PROFILE_LINK_CLASS}>
                      {agent.name}
                    </Link>
                  </td>
                  <td className="min-w-0 truncate px-3 py-2.5 align-middle font-mono text-fg-muted">
                    {agent.writingNumber || (
                      <span className="font-sans text-xs text-fg-faint">No writing number</span>
                    )}
                  </td>
                  <StateChipCell
                    codes={agent.writable}
                    label={`States ${agent.name} can write here`}
                    empty="No states yet"
                  />
                  <td className="px-3 py-2.5 align-middle">
                    <StatusBadge status={agent.status} />
                  </td>
                </>
              )}
            </ProfileTable>
          )}
        </Panel>

        <Panel title="Notes" count={notes.length}>
          {/* Cancels NoteList's own top margin; the panel body already pads. */}
          <div className="-mt-2">
            <HydratedNoteList notes={notes} labels={CARRIER_FIELD_LABELS} />
          </div>
        </Panel>

        <LoginsPanel logins={logins} partyHeading="Agent" className="xl:col-span-2" />
      </div>

      <CarrierDialog editor={editor} onSave={saveCarrierEdit} onClose={() => setEditor(null)} />
    </div>
  );
}
