"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { EditIcon } from "@/components/edit-icon";
import { CopyableNumber } from "@/components/license-number";
import {
  PasswordsPanel,
  Panel,
  PanelEmpty,
  PROFILE_BUTTON_CLASS,
  PROFILE_LABEL_CLASS,
  PROFILE_LINK_CLASS,
  ProfileNameRow,
  ProfileTable,
  StateChipCell,
} from "@/components/profile-shell";
import { ROW_BUTTON_CLASS } from "@/components/classes";
import { StatusBadge } from "@/components/status-badge";
import type { AgentStatus } from "@/lib/agents";
import type { CarrierPolicyRecord } from "@/lib/carrier-policies";
import type { CarrierRecord } from "@/lib/carriers";
import type { PasswordRecord } from "@/lib/passwords";
import type { PolicyTypeRecord } from "@/lib/policy-types";
import { byName } from "@/lib/text";
import { writableStates } from "@/lib/us-states";
import { saveCarrierPolicy } from "../policy-actions";
import {
  CarrierPolicyDialog,
  type CarrierPolicyEditor,
  type CarrierPolicyError,
  type CarrierPolicyValues,
} from "./carrier-policy-dialog";
import { CarrierStatesPanel } from "./carrier-states-panel";

/*
 * Profile for one carrier: identity (including the states it is available in,
 * one ceiling on its appointments), then everything linked to it — contracted
 * agents, its policies and passwords. Change notes are still recorded by
 * the API but not shown here. An agent row shows the
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
 * components/profile-shell.tsx: the name row (initials, name, status, Edit),
 * then three small cards in one row — Links (each by name), Lines of business,
 * Certifications — then the Available states map (each state's Life /
 * Health lines; carrier-states-panel.tsx), then Agents, Policies and Passwords, each full
 * width.
 *
 * The policies are kept in state so a policy edit shows at once; the carrier
 * comes from the server, and the
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
  /** Contracted agents, sorted by name. */
  agents: AgentRow[];
  /** This carrier's policies, sorted by name. */
  initialPolicies: CarrierPolicyRecord[];
  /** Every policy type, for the policy dialog's select. */
  policyTypes: PolicyTypeRecord[];
  /** This carrier's passwords, sorted by agent name. */
  passwords: PasswordRecord[];
};

const AGENT_COLUMNS = ["Agent", "Writing number", "Writable states", "Status"];
const POLICY_COLUMNS = ["Action", "Name", "Policy type", "Available states", "Status"];

export function CarrierProfile({ carrier, agents, initialPolicies, policyTypes, passwords }: CarrierProfileProps) {
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

      {/* Small cards for the carrier's details, in one row above the map. */}
      <div className="mt-5 mb-5 grid grid-cols-3 gap-3 sm:gap-5">
        <InfoCard title="Links">
          {carrier.links.length > 0 ? (
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {carrier.links.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.url}
                    className="font-medium text-brand-ink underline underline-offset-2 decoration-brand-ink/40 hover:decoration-brand-ink"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </InfoCard>
        <InfoCard title="Lines of business">
          {carrier.linesOfBusiness.length > 0 ? <LineChips lines={carrier.linesOfBusiness} /> : null}
        </InfoCard>
        <InfoCard title="Certifications">
          {carrier.certificationLines.length > 0 ? <LineChips lines={carrier.certificationLines} /> : null}
        </InfoCard>
      </div>

      {/* Then the states map. */}
      <CarrierStatesPanel rows={carrier.licenses} agents={agentRows} />

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        <Panel title="Agents" count={agentRows.length} className="xl:col-span-2">
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
                    <CopyableNumber value={agent.writingNumber} label="Writing number" empty="No writing number" />
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

        <Panel
          title="Policies"
          count={policies.length}
          className="xl:col-span-2"
          action={
            <button type="button" onClick={() => setPolicyEditor({ mode: "add" })} className={PROFILE_BUTTON_CLASS}>
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

        <PasswordsPanel passwords={passwords} party="agent" className="xl:col-span-2" />
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

/** A small card for one of the carrier's details, its title beside the value; empty shows a dash. */
function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border glass p-4 shadow-sm">
      <h2 className={`shrink-0 ${PROFILE_LABEL_CLASS}`}>{title}</h2>
      <div className="min-w-0 break-words text-sm text-fg">
        {children || <span className="text-fg-subtle">—</span>}
      </div>
    </section>
  );
}

/** Lines of business as chips. */
function LineChips({ lines }: { lines: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {lines.map((line) => (
        <li key={line} className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-ink">
          {line}
        </li>
      ))}
    </ul>
  );
}
