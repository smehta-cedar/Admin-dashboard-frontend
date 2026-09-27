"use client";

import Link from "next/link";
import { useState } from "react";
import { HydratedNoteList } from "@/components/hydrated-note-list";
import {
  LicenseCards,
  Panel,
  PanelEmpty,
  ProducerDetails,
  PROFILE_LINK_CLASS,
  ProfileHeader,
  ProfileNameRow,
  ProfileTable,
  StateChipCell,
} from "@/components/profile-shell";
import { StateLicensesPanel } from "@/components/state-licenses-panel";
import { StatusBadge } from "@/components/status-badge";
import type { AgencyNote, AgencyRecord } from "@/lib/agency";
import type { AgencyStateLicenseRecord } from "@/lib/agency-state-licenses";
import type { AgentRecord } from "@/lib/agents";
import { saveAgency } from "./actions";
import { AGENCY_FIELD_LABELS, AgencyDialog, type AgencyError, type AgencyValues } from "./agency-dialog";

/*
 * Profile for the agency: the one org record for this shop, laid out like an
 * agent's profile from the shared pieces in components/profile-shell.tsx. The
 * name row (initials, name, status, Edit) sits above one header card with the
 * contact details and the agency's licensed states, one small card per state
 * with its licence number. Below, a full-width State licences panel — the same
 * licences as rows (number, status, start and end dates); the rows are the
 * truth and the header's licensedStates / licenseNumbers are derived from
 * them, so an Edit changes both at once — then two panels: Agents — everyone
 * under the shop, linking to their profiles (agents are still edited on
 * Agents) — beside Notes, the agency's change log.
 *
 * Edit opens AgencyDialog, the producer form with org labels, and saves
 * through the saveAgency server action: the agency and its licence rows are
 * kept in state so the change shows at once, and the notes come from the
 * server (the API writes them; the action's revalidation brings the new one
 * in). No back link or switcher: there is one agency and no list of them.
 */

type AgentRow = Pick<AgentRecord, "id" | "name" | "status" | "licensedStates">;

type AgencyProfileProps = {
  initialAgency: AgencyRecord;
  /** The agency's notes, newest first. */
  notes: AgencyNote[];
  /** The agency's state licence rows, in state-code order. */
  initialLicenses: AgencyStateLicenseRecord[];
  /** Every agent, sorted by name. */
  agents: AgentRow[];
};

const AGENT_COLUMNS = ["Agent", "Licensed states", "Status"];

export function AgencyProfile({ initialAgency, notes, initialLicenses, agents }: AgencyProfileProps) {
  const [agency, setAgency] = useState(initialAgency);
  const [licenses, setLicenses] = useState(initialLicenses);
  const [editing, setEditing] = useState<AgencyRecord | null>(null);

  /** Edits the agency through the API. Resolves with the dialog's error, if any. */
  const saveEdit = async (values: AgencyValues): Promise<AgencyError | null> => {
    const result = await saveAgency(values, agency.id);
    if (!result.ok) return result.error;
    setAgency(result.agency);
    setLicenses(result.licenses);
    return null;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <ProfileNameRow
        name={agency.name}
        status={agency.status}
        eyebrow="Agency"
        onEdit={() => setEditing(agency)}
      />

      <ProfileHeader
        details={
          <ProducerDetails
            npn={agency.npn}
            email={agency.email}
            phone={agency.phone}
            aliases={agency.aliases}
            aliasesLabel="Other names"
          />
        }
        asideTitle="Licensed states"
        asideCount={agency.licensedStates.length}
        asideTooltip="The agency's own licences."
      >
        <LicenseCards
          codes={agency.licensedStates}
          numbers={agency.licenseNumbers}
          empty="No agency licences recorded yet."
        />
      </ProfileHeader>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        <StateLicensesPanel licenses={licenses} className="xl:col-span-2" />

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
            <ProfileTable columns={AGENT_COLUMNS} rows={agents} rowKey={(agent) => agent.id}>
              {(agent) => (
                <>
                  <td className="px-3 py-2.5 align-middle sm:whitespace-nowrap">
                    <Link href={`/agents/${agent.id}`} className={PROFILE_LINK_CLASS}>
                      {agent.name}
                    </Link>
                  </td>
                  <StateChipCell
                    codes={agent.licensedStates}
                    label={`States ${agent.name} is licensed in`}
                    empty="No licences yet"
                  />
                  <td className="px-3 py-2.5">
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
            <HydratedNoteList notes={notes} labels={AGENCY_FIELD_LABELS} />
          </div>
        </Panel>
      </div>

      <AgencyDialog editing={editing} onSave={saveEdit} onClose={() => setEditing(null)} />
    </div>
  );
}
