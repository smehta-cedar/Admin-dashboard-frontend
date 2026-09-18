"use client";

import Link from "next/link";
import { useState } from "react";
import { EntitySwitcher } from "@/components/entity-switcher";
import { HydratedNoteList } from "@/components/hydrated-note-list";
import {
  LicenseCards,
  LoginsPanel,
  Panel,
  PanelEmpty,
  ProducerDetails,
  PROFILE_BUTTON_CLASS,
  PROFILE_LINK_CLASS,
  ProfileBackLink,
  ProfileHeader,
  ProfileNameRow,
  ProfileTable,
  StateChipCell,
  type ProfileLogin,
} from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import { UnsavedBanner } from "@/components/unsaved-banner";
import type { AgentNote, AgentRecord } from "@/lib/agents";
import type {
  CarrierContractNote,
  CarrierContractRecord,
} from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import { writableStates } from "@/lib/us-states";
import { byName } from "@/lib/text";
import { AppointmentDialog } from "../../contracts/appointment-dialog";
import { useAppointments } from "../../contracts/use-appointments";
import {
  AGENT_FIELD_LABELS,
  AgentDialog,
  saveAgent,
  type AgentEditor,
  type AgentError,
  type AgentValues,
} from "../agent-dialog";

/*
 * Profile for one agent: identity, then everything linked to them — the states
 * they can write in, contracted carriers, what is still pending, logins, and
 * change notes. Logins are still edited on their page. Two things are editable
 * here: the agent's own fields (Edit opens the same AgentDialog as the Agents
 * list) and appointing this agent to a carrier.
 *
 * Layout, from the shared pieces in components/profile-shell.tsx: the name row
 * (initials, name, status, Edit) sits above one header card holding the
 * contact details and the licensed states, one small card per state: the code
 * beside its licence number (the state's name is the tooltip). Below it two
 * rows of two panels on wide screens: Carriers beside Pending, then Logins
 * beside Notes. They stack otherwise.
 *
 * States show in two places. "Licensed states" is the agent's own licences
 * (AgentRecord.licensedStates): where they may write at all, whoever the
 * carrier, each with the licence number that state issued
 * (AgentRecord.licenseNumbers) or "No number yet". Each carrier row then lists
 * where they can actually write with that carrier — a state counts only when
 * it is licensed, inside the carrier's footprint, and listed on the
 * appointment. There is no combined list across carriers. Carrier names link
 * to their profiles.
 *
 * Pending is worked out from what is on the page, not stored: there are no
 * task records yet. See `pendingItems`.
 *
 * "Add carrier" opens the shared AppointmentDialog
 * (../../contracts/appointment-dialog.tsx) in add mode with this agent
 * pre-filled — the same form and the same saveAppointment as Contracts, so the
 * duplicate and available-states checks are identical. An inactive agent can
 * still be appointed and keeps their carriers listed: contracts follow the
 * agent, not their status, on every page (the Contracts pages just leave them
 * out of the counts). It is all dummy like the rest: the agent, contracts and
 * notes live in component state, and a refresh brings back the JSON. page.tsx
 * keys this component by agent ID, so switching agents starts that state again.
 */

type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status" | "availableStates">;

type AgentProfileProps = {
  initialAgent: AgentRecord;
  /** Every agent: the switcher's options and the NPN uniqueness check. */
  allAgents: Pick<AgentRecord, "id" | "name" | "status" | "npn">[];
  /** Every carrier, sorted by name, for the Add carrier dialog. */
  carriers: CarrierOption[];
  /** Every contract, not just this agent's: the duplicate check and new IDs need them all. */
  initialContracts: CarrierContractRecord[];
  /** Every contract note, newest first. Not shown here; new ones are still recorded. */
  initialContractNotes: CarrierContractNote[];
  /** This agent's logins, the carrier as the party, sorted by carrier name. */
  logins: ProfileLogin[];
  /** Every agent's notes, newest first: new note IDs need them all. Only this agent's are shown. */
  initialNotes: AgentNote[];
};

const CARRIER_COLUMNS = ["Carrier", "Writable states", "Status"];

/** "Humana", "Humana and UHC", "Humana, UHC and WellCare". */
function listText(items: string[]) {
  return items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

type PendingItem = { key: string; title: string; detail: string; href?: string; linkLabel?: string };

type PendingInput = {
  agent: AgentRecord;
  agentCarriers: (CarrierOption & { writable: string[] })[];
  logins: ProfileLogin[];
};

/**
 * What still needs doing for this agent, worked out from the page's own data:
 * missing licences or licence numbers, appointments that can't write anywhere yet, licensed
 * states no carrier covers, carriers without a login, logins without a
 * contract, and logins still pending.
 */
function pendingItems({ agent, agentCarriers, logins }: PendingInput): PendingItem[] {
  const items: PendingItem[] = [];

  if (agent.licensedStates.length === 0) {
    items.push({
      key: "licences",
      title: "Record licensed states",
      detail: "Without a licence this agent can't write anywhere, whatever the carrier.",
    });
  }

  const unnumbered = agent.licensedStates.filter((code) => !agent.licenseNumbers[code]);
  if (unnumbered.length > 0) {
    items.push({
      key: "licence-numbers",
      title: `Record the licence ${unnumbered.length === 1 ? "number" : "numbers"} for ${listText(unnumbered)}`,
      detail: "Licensed there, but the state's licence number isn't on file. Add it with Edit.",
    });
  }

  for (const carrier of agentCarriers) {
    if (carrier.writable.length === 0) {
      items.push({
        key: `states-${carrier.id}`,
        title: `Finish the ${carrier.name} contract`,
        detail: "Appointed, but with no writable states yet.",
        href: "/contracts",
        linkLabel: "Contracts",
      });
    }
  }

  const covered = new Set(agentCarriers.flatMap((carrier) => carrier.writable));
  const uncovered = agent.licensedStates.filter((code) => !covered.has(code));
  if (uncovered.length > 0 && agentCarriers.length > 0) {
    items.push({
      key: "uncovered",
      title: `No carrier in ${listText(uncovered)}`,
      detail: `Licensed there, but no appointment lists ${uncovered.length === 1 ? "it" : "them"}.`,
    });
  } else if (agent.licensedStates.length > 0 && agentCarriers.length === 0) {
    items.push({
      key: "no-carriers",
      title: "Appoint to a carrier",
      detail: "Licensed, but not contracted with any carrier yet.",
    });
  }

  // One line however many carriers, so a new agent's list stays short.
  const withoutLogin = agentCarriers.filter(
    (carrier) => !logins.some((login) => login.carrierId === carrier.id),
  );
  if (withoutLogin.length > 0) {
    items.push({
      key: "no-login",
      title: `Add ${withoutLogin.length === 1 ? "a login" : "logins"} for ${listText(withoutLogin.map((carrier) => carrier.name))}`,
      detail: "Contracted, but no writing number or portal login recorded.",
      href: withoutLogin.length === 1 ? `/logins?carrier=${withoutLogin[0].id}` : "/logins",
      linkLabel: "Logins",
    });
  }

  for (const login of logins) {
    if (!agentCarriers.some((carrier) => carrier.id === login.carrierId)) {
      items.push({
        key: `uncontracted-${login.id}`,
        title: `${login.partyName} login has no contract`,
        detail: "A login is recorded, but this agent isn't appointed with the carrier.",
      });
    }
  }

  for (const login of logins) {
    if (login.status === "pending") {
      items.push({
        key: `pending-${login.id}`,
        title: `${login.partyName} login is pending`,
        detail: `Writing number ${login.writingNumber || "not set"}. Mark it active once the carrier confirms.`,
        href: `/logins?carrier=${login.carrierId}`,
        linkLabel: "Logins",
      });
    }
  }

  return items;
}

export function AgentProfile({
  initialAgent,
  allAgents,
  carriers,
  initialContracts,
  initialContractNotes,
  logins,
  initialNotes,
}: AgentProfileProps) {
  const [agent, setAgent] = useState(initialAgent);
  const [allNotes, setAllNotes] = useState(initialNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [agentEditor, setAgentEditor] = useState<AgentEditor | null>(null);
  // The dialog locks the agent to this profile, so the live agent is the only
  // lookup it needs; an edited name or licence list is read at save time.
  const { contracts, editor, setEditor, saveContract } = useAppointments({
    initialContracts,
    initialNotes: initialContractNotes,
    agents: [agent],
    carriers,
    onSaved: () => setUnsavedCount((count) => count + 1),
  });

  // An edit here shows at once in the switcher too.
  const agents = allAgents.map((other) => (other.id === agent.id ? agent : other));
  const notes = allNotes.filter((note) => note.agentId === agent.id);

  // This agent's carriers, rebuilt from state so a new appointment shows at once.
  // `writable` is what the appointment actually buys them: its states within
  // this agent's licences and that carrier's footprint.
  const agentCarriers = contracts
    .filter((contract) => contract.agentId === agent.id)
    .flatMap((contract) => {
      const carrier = carriers.find((option) => option.id === contract.carrierId);
      return carrier
        ? [
            {
              ...carrier,
              writable: writableStates(
                contract.appointedStates,
                agent.licensedStates,
                carrier.availableStates,
              ),
            },
          ]
        : [];
    })
    .sort(byName);

  const pending = pendingItems({ agent, agentCarriers, logins });

  /** Edits this agent. Returns the dialog's error, if any. */
  const saveAgentEdit = (values: AgentValues): AgentError | null => {
    const result = saveAgent({ agents, notes: allNotes, values, editing: agent });
    if (result.error !== null) return result.error;
    if (!result.changed) return null;

    setAgent(result.agent);
    setAllNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    return null;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProfileBackLink href="/agents" label="Agents" />
        <EntitySwitcher
          label="Switch agent"
          currentId={agent.id}
          options={agents}
          hrefFor={(id) => `/agents/${id}`}
        />
      </div>

      <ProfileNameRow
        name={agent.name}
        status={agent.status}
        onEdit={() => setAgentEditor({ mode: "edit", agent })}
      />

      <ProfileHeader
        details={
          <ProducerDetails
            npn={agent.npn}
            email={agent.email}
            phone={agent.phone}
            aliases={agent.aliases}
            aliasesLabel="Aliases"
          />
        }
        asideTitle="Licensed states"
        asideCount={agent.licensedStates.length}
        asideTooltip="Personal licences, whoever the carrier."
      >
        <LicenseCards
          codes={agent.licensedStates}
          numbers={agent.licenseNumbers}
          empty="No licences recorded, so this agent can't write anywhere yet."
        />
      </ProfileHeader>

      <UnsavedBanner count={unsavedCount} className="mt-4" />

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        <Panel
          title="Carriers"
          count={agentCarriers.length}
          action={
            carriers.length > 0 ? (
              <button
                type="button"
                onClick={() => setEditor({ mode: "add", agentId: agent.id })}
                className={PROFILE_BUTTON_CLASS}
              >
                <span aria-hidden="true">+ </span>Add carrier
                <span className="sr-only"> for {agent.name}</span>
              </button>
            ) : null
          }
        >
          {agentCarriers.length === 0 ? (
            <PanelEmpty>Not contracted with any carriers.</PanelEmpty>
          ) : (
            <ProfileTable
              columns={CARRIER_COLUMNS}
              rows={agentCarriers}
              rowKey={(carrier) => carrier.id}
            >
              {(carrier) => (
                <>
                  <td className="px-3 py-2.5 align-middle sm:whitespace-nowrap">
                    <Link href={`/carriers/${carrier.id}`} className={PROFILE_LINK_CLASS}>
                      {carrier.name}
                    </Link>
                  </td>
                  <StateChipCell
                    codes={carrier.writable}
                    label={`States writable with ${carrier.name}`}
                    empty="No states yet"
                  />
                  <td className="px-3 py-2.5">
                    <StatusBadge status={carrier.status} />
                  </td>
                </>
              )}
            </ProfileTable>
          )}
        </Panel>

        <Panel title="Pending" count={pending.length}>
          {pending.length === 0 ? (
            <PanelEmpty>Nothing pending. Licences, contracts and logins all line up.</PanelEmpty>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line text-sm">
              {pending.map((item) => (
                <li key={item.key} className="flex items-start gap-3 px-4 py-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-warn-ink"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-fg">{item.title}</p>
                    <p className="mt-0.5 text-xs text-fg-muted">{item.detail}</p>
                  </div>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="shrink-0 whitespace-nowrap text-xs font-medium text-brand-ink hover:underline"
                    >
                      {item.linkLabel}
                      <span aria-hidden="true"> →</span>
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <LoginsPanel logins={logins} partyHeading="Carrier" />

        <Panel title="Notes" count={notes.length}>
          {/* Cancels NoteList's own top margin; the panel body already pads. */}
          <div className="-mt-2">
            <HydratedNoteList notes={notes} labels={AGENT_FIELD_LABELS} />
          </div>
        </Panel>
      </div>

      <AgentDialog editor={agentEditor} onSave={saveAgentEdit} onClose={() => setAgentEditor(null)} />

      {/* Agent locked to this profile: the only option, already chosen. */}
      <AppointmentDialog
        editor={editor}
        agents={[
          { id: agent.id, name: agent.name, status: agent.status, licensedStates: agent.licensedStates },
        ]}
        carriers={carriers}
        onSave={saveContract}
        onClose={() => setEditor(null)}
      />
    </div>
  );
}
