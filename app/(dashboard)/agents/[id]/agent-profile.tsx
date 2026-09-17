"use client";

import Link from "next/link";
import { useState } from "react";
import { ROW_BUTTON_CLASS } from "@/components/classes";
import { ProfileSection, ProfileShell } from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import type { AgentNote, AgentRecord } from "@/lib/agents";
import type {
  CarrierContractNote,
  CarrierContractRecord,
} from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import type { LoginRecord } from "@/lib/logins";
import { US_STATE_NAMES, writableStates } from "@/lib/us-states";
import {
  AppointmentDialog,
  saveAppointment,
  type AppointmentEditor,
  type AppointmentError,
  type AppointmentValues,
} from "../../contracts/appointment-dialog";
import { CredentialValue } from "../../logins/credential-value";
import { AgentNotes } from "./agent-notes";
import { AgentSwitcher } from "./agent-switcher";

/*
 * Profile for one agent: identity, then everything linked to them — the states
 * they can write in, contracted carriers, logins, and change notes. Logins and
 * the agent's own fields are still edited on their pages; the one thing editable
 * here is appointing this agent to a carrier.
 *
 * States show in two places. "Licensed states" is the agent's own licences
 * (AgentRecord.licensedStates, edited on Agents): where they may write at all,
 * whoever the carrier. Each carrier row then lists where they can actually
 * write with that carrier — a state counts only when it is licensed, inside
 * the carrier's footprint, and listed on the appointment. There is no combined
 * list across carriers. Carrier names link to their profiles.
 *
 * "Add carrier" opens the shared AppointmentDialog
 * (../../contracts/appointment-dialog.tsx) in add mode with this agent
 * pre-filled — the same form and the same saveAppointment as Contracts, so the
 * duplicate and available-states checks are identical. It is dummy like the
 * rest: contracts and notes live in component state, and a refresh brings back
 * the JSON.
 */

type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status" | "availableStates">;

type AgentProfileProps = {
  agent: AgentRecord;
  /** Every agent, sorted by name, for the switcher. */
  allAgents: Pick<AgentRecord, "id" | "name" | "status">[];
  /** Every carrier, sorted by name, for the Add carrier dialog. */
  carriers: CarrierOption[];
  /** Every contract, not just this agent's: the duplicate check and new IDs need them all. */
  initialContracts: CarrierContractRecord[];
  /** Every contract note, newest first. Not shown here; new ones are still recorded. */
  initialContractNotes: CarrierContractNote[];
  /** Sorted by carrier name. */
  logins: (LoginRecord & { carrierName: string })[];
  /** Newest first. */
  notes: AgentNote[];
};

const LOGIN_COLUMNS = ["Carrier", "Writing number", "Portal username", "Password", "Status"];

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** A state code chip, with the full name on hover and for screen readers. */
function StateChip({ code }: { code: string }) {
  return (
    <li
      title={US_STATE_NAMES[code]}
      className="rounded-md bg-surface-muted px-2 py-1 font-mono text-xs font-medium text-fg-muted"
    >
      {code}
      {US_STATE_NAMES[code] ? <span className="sr-only"> ({US_STATE_NAMES[code]})</span> : null}
    </li>
  );
}

export function AgentProfile({
  agent,
  allAgents,
  carriers,
  initialContracts,
  initialContractNotes,
  logins,
  notes,
}: AgentProfileProps) {
  const [contracts, setContracts] = useState(initialContracts);
  const [contractNotes, setContractNotes] = useState(initialContractNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [editor, setEditor] = useState<AppointmentEditor | null>(null);

  const agentName = (agentId: string) =>
    allAgents.find((other) => other.id === agentId)?.name ?? `Agent ${agentId}`;
  const carrierName = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.name ?? `Carrier ${carrierId}`;
  const availableStates = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.availableStates ?? [];

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

  /** Appoints this agent to a carrier. Returns the dialog's error message, if any. */
  const saveContract = (
    values: AppointmentValues,
    editing?: CarrierContractRecord,
  ): AppointmentError | null => {
    const result = saveAppointment({
      contracts,
      notes: contractNotes,
      values,
      editing,
      agentName,
      carrierName,
      availableStates,
      // The dialog locks the agent to this profile, so this is the only answer.
      licensedStates: () => agent.licensedStates,
    });
    if (result.error !== null) return result.error;
    if (!result.changed) return null;

    setContracts(result.contracts);
    setContractNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    return null;
  };

  return (
    <ProfileShell
      back={{ href: "/agents", label: "Agents" }}
      title={agent.name}
      status={agent.status}
      actions={<AgentSwitcher currentId={agent.id} agents={allAgents} />}
      subtitle={<span className="font-mono">Agent #{agent.id}</span>}
      identity={[
        { label: "NPN", value: <span className="font-mono">{agent.npn}</span> },
        { label: "Email", value: agent.email },
        { label: "Phone", value: agent.phone },
        { label: "Aliases", value: agent.aliases.join(", ") },
      ]}
      banner={
        <div role="status">
          {unsavedCount > 0 ? (
            <p className="mb-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink">
              {unsavedCount === 1 ? "1 change" : `${unsavedCount} changes`} made on this page only.
              Nothing is saved yet, so refreshing undoes {unsavedCount === 1 ? "it" : "them"}.
            </p>
          ) : null}
        </div>
      }
    >
      <ProfileSection
        title="Licensed states"
        count={agent.licensedStates.length}
        emptyMessage="No licences recorded, so this agent can't write anywhere yet."
      >
        <p className="mb-2 text-xs text-fg-subtle">
          Personal licences, whoever the carrier. Edited on Agents.
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {agent.licensedStates.map((code) => (
            <StateChip key={code} code={code} />
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection
        title="Carriers"
        count={agentCarriers.length}
        action={
          carriers.length > 0 ? (
            <button
              type="button"
              onClick={() => setEditor({ mode: "add", agentId: agent.id })}
              className={ROW_BUTTON_CLASS}
            >
              <span aria-hidden="true">+ </span>Add carrier
              <span className="sr-only"> for {agent.name}</span>
            </button>
          ) : null
        }
      >
        {agentCarriers.length === 0 ? (
          <p className="text-sm text-fg-subtle">Not contracted with any carriers.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line text-sm">
            {agentCarriers.map((carrier) => (
              <li key={carrier.id} className="flex flex-col gap-2 px-4 py-2.5">
                <div className="flex items-center justify-between gap-4">
                  <Link href={`/carriers/${carrier.id}`} className="text-fg hover:underline">
                    {carrier.name}
                  </Link>
                  <StatusBadge status={carrier.status} />
                </div>
                {carrier.writable.length > 0 ? (
                  <ul
                    aria-label={`States writable with ${carrier.name}`}
                    className="flex flex-wrap gap-1"
                  >
                    {carrier.writable.map((code) => (
                      <StateChip key={code} code={code} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-fg-faint">No states yet</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </ProfileSection>

      <ProfileSection title="Logins" count={logins.length} emptyMessage="No logins recorded.">
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-muted">
              <tr>
                {LOGIN_COLUMNS.map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="whitespace-nowrap px-4 py-2.5 font-medium text-fg-muted"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {logins.map((login) => (
                <tr key={login.id}>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Link href={`/carriers/${login.carrierId}`} className="text-fg hover:underline">
                      {login.carrierName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-fg-muted">{login.writingNumber}</td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    <CredentialValue value={login.username} label="username" />
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    <CredentialValue value={login.portalPassword} label="password" secret />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={login.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProfileSection>

      <ProfileSection title="Notes" count={notes.length}>
        <AgentNotes notes={notes} />
      </ProfileSection>

      {/* Agent locked to this profile: the only option, already chosen. */}
      <AppointmentDialog
        editor={editor}
        agents={[{ id: agent.id, name: agent.name, licensedStates: agent.licensedStates }]}
        carriers={carriers}
        onSave={saveContract}
        onClose={() => setEditor(null)}
      />
    </ProfileShell>
  );
}
