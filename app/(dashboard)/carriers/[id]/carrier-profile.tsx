"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EditIcon } from "@/components/edit-icon";
import { HydratedNoteList } from "@/components/hydrated-note-list";
import { CopyableNumber } from "@/components/license-number";
import {
  Detail,
  PasswordsPanel,
  Panel,
  PanelEmpty,
  PROFILE_BUTTON_CLASS,
  PROFILE_LINK_CLASS,
  ProfileHeader,
  ProfileNameRow,
  ProfileTable,
  StateChip,
  StateChipCell,
  type ProfilePassword,
} from "@/components/profile-shell";
import { ROW_BUTTON_CLASS } from "@/components/classes";
import { StateLicensesPanel } from "@/components/state-licenses-panel";
import { StatusBadge } from "@/components/status-badge";
import type { AgentStatus } from "@/lib/agents";
import type { CarrierPolicyRecord } from "@/lib/carrier-policies";
import type { CarrierNote, CarrierRecord } from "@/lib/carriers";
import type { PolicyTypeRecord } from "@/lib/policy-types";
import { byName } from "@/lib/text";
import { writableStates } from "@/lib/us-states";
import { CARRIER_FIELD_LABELS } from "../carrier-form";
import { saveCarrierPolicy } from "../policy-actions";
import {
  CarrierPolicyDialog,
  type CarrierPolicyEditor,
  type CarrierPolicyError,
  type CarrierPolicyValues,
} from "./carrier-policy-dialog";

/*
 * Profile for one carrier: identity (including the states it is available in,
 * one ceiling on its appointments), then everything linked to it — contracted
 * agents, its policies, passwords, and change notes. An agent row shows the
 * states they can actually write here: their appointment narrowed to their
 * own licences (Agents) and this carrier's footprint. Edit opens
 * /carriers/[id]/edit (../carrier-form.tsx), which comes back here with the
 * saved carrier. Agent names link to their profiles.
 *
 * Policies live here and nowhere else: the Policies panel lists the carrier's
 * named policies (name, policy type, available states, status) and opens the
 * CarrierPolicyDialog from Add policy and a row's Edit; saves go through the
 * saveCarrierPolicy server action. A policy's states are offered only from
 * this carrier's live footprint.
 *
 * Same layout as the agent profile, built from the shared pieces in
 * components/profile-shell.tsx: the name row (initials, name, status, Edit)
 * over one header card holding the carrier's details beside its available
 * states, then panels: State licences (each state's licence #, lines,
 * status and dates) full width, Agents beside Notes, and Policies and
 * Passwords full width under them.
 *
 * The policies are kept in state so a policy edit shows at once; the carrier
 * and the notes come from the server (the API writes the notes), and the
 * save actions' revalidation brings changes in. page.tsx keys this component
 * by carrier ID, so switching carriers starts that state again.
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
  carrier: CarrierRecord;
  /** The carrier's place in the name-sorted list, 1…n, as the Carriers page shows it. */
  number: number;
  /** Contracted agents, sorted by name. */
  agents: AgentRow[];
  /** This carrier's policies, sorted by name. */
  initialPolicies: CarrierPolicyRecord[];
  /** Every policy type, for the policy dialog's select. */
  policyTypes: PolicyTypeRecord[];
  /** This carrier's passwords, the agent as the party, sorted by agent name. */
  passwords: ProfilePassword[];
  /** This carrier's notes, newest first. */
  notes: CarrierNote[];
};

const AGENT_COLUMNS = ["Agent", "Writing number", "Writable states", "Status"];
const POLICY_COLUMNS = ["Action", "Name", "Policy type", "Available states", "Status"];

export function CarrierProfile({
  carrier,
  number,
  agents,
  initialPolicies,
  policyTypes,
  passwords,
  notes,
}: CarrierProfileProps) {
  const router = useRouter();
  const [policies, setPolicies] = useState(initialPolicies);
  const [policyEditor, setPolicyEditor] = useState<CarrierPolicyEditor | null>(null);

  // Writable is what the appointment actually buys them: its states within
  // this agent's licences and this carrier's live footprint.
  const agentRows = agents.map((agent) => ({
    ...agent,
    writable: writableStates(agent.appointedStates, agent.licensedStates, carrier.availableStates),
  }));

  /** Adds or edits one of this carrier's policies through the API. Resolves with the dialog's errors, if any. */
  const savePolicy = async (values: CarrierPolicyValues): Promise<CarrierPolicyError[]> => {
    const editingId = policyEditor?.mode === "edit" ? policyEditor.policy.id : undefined;
    const result = await saveCarrierPolicy(carrier.id, values, editingId);
    if (!result.ok) return result.errors;
    setPolicies((current) =>
      [...current.filter((policy) => policy.id !== result.policy.id), result.policy].sort(byName),
    );
    return [];
  };

  return (
    <div className="mx-auto max-w-7xl">
      <ProfileNameRow
        name={carrier.name}
        status={carrier.status}
        onEdit={() => router.push(`/carriers/${carrier.id}/edit?from=profile`)}
      />

      <ProfileHeader
        details={
          <>
            <Detail label="Carrier ID">
              <span className="font-mono">#{number}</span>
            </Detail>
            <Detail label="Aliases">{carrier.aliases.join(", ")}</Detail>
            <Detail label="Link">
              {carrier.link ? (
                <a
                  href={carrier.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`break-all ${PROFILE_LINK_CLASS}`}
                >
                  {carrier.link}
                </a>
              ) : null}
            </Detail>
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
            <Detail label="Certifications">
              {carrier.certificationLines.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {carrier.certificationLines.map((line) => (
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

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        <StateLicensesPanel licenses={carrier.licenses} showLines className="xl:col-span-2" />

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
                  <td className="min-w-0 px-3 py-2.5 align-middle">
                    <CopyableNumber
                      value={agent.writingNumber}
                      label="Writing number"
                      empty="No writing number"
                    />
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

        <Panel
          title="Policies"
          count={policies.length}
          className="xl:col-span-2"
          action={
            <button
              type="button"
              onClick={() => setPolicyEditor({ mode: "add" })}
              className={PROFILE_BUTTON_CLASS}
            >
              <span aria-hidden="true">+ </span>Add policy
              <span className="sr-only"> for {carrier.name}</span>
            </button>
          }
        >
          {policies.length === 0 ? (
            <PanelEmpty>No policies recorded.</PanelEmpty>
          ) : (
            <ProfileTable columns={POLICY_COLUMNS} rows={policies} rowKey={(policy) => policy.id}>
              {(policy) => (
                <>
                  <td className="px-3 py-1.5 align-middle whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setPolicyEditor({ mode: "edit", policy })}
                      className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
                    >
                      <EditIcon className="size-3.5 shrink-0" />
                      <span className="sr-only"> {policy.name}</span>
                    </button>
                  </td>
                  <td className="min-w-0 truncate px-3 py-2.5 align-middle font-medium text-fg sm:whitespace-nowrap">
                    {policy.name}
                  </td>
                  <td className="min-w-0 truncate px-3 py-2.5 align-middle text-fg-muted">
                    {policy.policyTypeName || <span className="text-fg-subtle">—</span>}
                  </td>
                  <StateChipCell
                    codes={policy.availableStates}
                    label={`States ${policy.name} can be sold in`}
                    empty="No states yet"
                  />
                  <td className="px-3 py-2.5 align-middle">
                    <StatusBadge status={policy.status} />
                  </td>
                </>
              )}
            </ProfileTable>
          )}
        </Panel>

        <PasswordsPanel passwords={passwords} partyHeading="Agent" className="xl:col-span-2" />
      </div>

      <CarrierPolicyDialog
        editor={policyEditor}
        carrierName={carrier.name}
        carrierStates={carrier.availableStates}
        policyTypes={policyTypes}
        onSave={savePolicy}
        onClose={() => setPolicyEditor(null)}
      />
    </div>
  );
}
