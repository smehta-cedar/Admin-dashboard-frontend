"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";
import { ROW_BUTTON_CLASS } from "@/components/classes";
import { EditIcon } from "@/components/edit-icon";
import { HydratedNoteList } from "@/components/hydrated-note-list";
import {
  LicenseCards,
  Panel,
  PanelEmpty,
  ProducerDetails,
  PROFILE_BUTTON_CLASS,
  PROFILE_LINK_CLASS,
  ProfileHeader,
  ProfileNameRow,
  ProfileTable,
  StateChipCell,
} from "@/components/profile-shell";
import { StateLicensesPanel } from "@/components/state-licenses-panel";
import { StatusBadge } from "@/components/status-badge";
import type { AgencyComment, AgencyNote, AgencyRecord } from "@/lib/agency";
import type { AgencyContractRecord } from "@/lib/agency-contracts";
import type { AgencyStateLicenseRecord } from "@/lib/agency-state-licenses";
import type { AgentRecord } from "@/lib/agents";
import { removeAgencyLicense, saveAgency, saveAgencyLicense } from "./actions";
import { AgencyNotesPanel } from "./agency-notes-panel";
import {
  AgencyContractDialog,
  type AgencyContractEditor,
  type AgencyContractError,
  type AgencyContractValues,
} from "./agency-contract-dialog";
import { saveAgencyContract } from "./contract-actions";
import { addPolicyType } from "./policy-type-actions";
import { AGENCY_FIELD_LABELS, AgencyDialog, type AgencyError, type AgencyValues } from "./agency-dialog";
import { AgencyLicenseDialog, type AgencyLicenseEditor, type AgencyLicenseValues } from "./license-dialog";

/*
 * Profile for the agency: the one org record for this shop, laid out like an
 * agent's profile from the shared pieces in components/profile-shell.tsx. The
 * name row (initials, name, status, Edit) sits above one header card with the
 * contact details and the agency's licensed states, one small card per state
 * with its licence number. Below, a full-width State licences panel — the same
 * licences as rows (number, status, start and end dates); the rows are the
 * truth and the header's licensedStates / licenseNumbers are derived from
 * them, so a change to a row changes both at once — then, each full width,
 * Agents — everyone under the shop with their licensed states and the
 * carriers they're appointed with, linking to their profiles (agents are
 * still edited on Agents) — Notes, for notes people write on the agency
 * (./agency-notes-panel.tsx), and last History, the agency's change log.
 *
 * Two editors. The name row's Edit opens AgencyDialog, the producer form
 * with org labels and no licences, and saves the agency's own fields
 * through the saveAgency server action. The State licences panel's Add
 * button and each row's Edit open AgencyLicenseDialog for one licence
 * (state, number, status, start and end dates; Edit can also remove it),
 * saved through saveAgencyLicense / removeAgencyLicense, which send the API
 * the full set of rows with the one change; a saved licence can also give
 * the ticked agents a pending licence in that state. Every save returns the agency
 * and its rows, kept in state so the change shows at once; the notes come
 * from the server (the API writes them; the action's revalidation brings
 * the new one in). No back link or switcher: there is one agency and no
 * list of them.
 *
 * A full-width Contracts panel, under State licences, lists the agency's
 * contract with each carrier (carrier, contract number, policy types, status)
 * and opens AgencyContractDialog from Add contract and a row's Edit, saved
 * through saveAgencyContract; the dialog adds new policy types through
 * addPolicyType (./policy-type-actions.ts) and can appoint agents with the
 * carrier in the same save. Only an active contract with a number opens its
 * carrier to agents. A carrier whose contract has no number yet
 * shows "No number yet": agents can't be given that carrier until it has
 * one. The panel is left out when the role can't see agency contracts (the
 * page passes null).
 */

/** An agent on the roster, with the carriers they're appointed with, by name. */
type AgentRow = Pick<AgentRecord, "id" | "name" | "status" | "licensedStates"> & { carriers: string[] };

type AgencyProfileProps = {
  initialAgency: AgencyRecord;
  /** The agency's change notes (the History panel), newest first. */
  notes: AgencyNote[];
  /** Notes written on the agency (the Notes panel), newest first. */
  comments: AgencyComment[];
  /** Whether the Notes panel can add and delete notes (the role can edit agencies). */
  canWriteNotes: boolean;
  /** The agency's state licence rows, in state-code order. */
  initialLicenses: AgencyStateLicenseRecord[];
  /** Every agent, sorted by name. */
  agents: AgentRow[];
  /** The agency's carrier contracts, by carrier name; null hides the panel (no permission). */
  initialContracts: AgencyContractRecord[] | null;
  /** Every carrier, for the contract dialog's select. */
  carriers: ComponentProps<typeof AgencyContractDialog>["carriers"];
  /** Every policy type, for the contract dialog's boxes. */
  policyTypes: ComponentProps<typeof AgencyContractDialog>["policyTypes"];
  /** Every agent's carriers, for the contract dialog's Agents boxes; null hides them (no permission). */
  appointments: ComponentProps<typeof AgencyContractDialog>["appointments"];
  /** Whether the licence dialog shows its Agents boxes (the role can edit agents). */
  canLicenseAgents: boolean;
};

const AGENT_COLUMNS = ["Agent", "Licensed states", "Carriers"];
const CONTRACT_COLUMNS = ["Action", "Carrier", "Writing number", "Policy types", "Status"];

export function AgencyProfile({
  initialAgency,
  notes,
  comments,
  canWriteNotes,
  initialLicenses,
  agents,
  initialContracts,
  carriers,
  policyTypes,
  appointments,
  canLicenseAgents,
}: AgencyProfileProps) {
  const [agency, setAgency] = useState(initialAgency);
  const [licenses, setLicenses] = useState(initialLicenses);
  const [contracts, setContracts] = useState(initialContracts);
  const [contractEditor, setContractEditor] = useState<AgencyContractEditor | null>(null);
  const [editing, setEditing] = useState<AgencyRecord | null>(null);
  const [licenseEditor, setLicenseEditor] = useState<AgencyLicenseEditor | null>(null);

  /** Edits the agency through the API. Resolves with the dialog's error, if any. */
  const saveEdit = async (values: AgencyValues): Promise<AgencyError | null> => {
    const result = await saveAgency(values, agency.id);
    if (!result.ok) return result.error;
    setAgency(result.agency);
    setLicenses(result.licenses);
    return null;
  };

  /** Adds a licence, or replaces the row `previousState` had. Resolves with the message to show, if any. */
  const saveLicense = async (values: AgencyLicenseValues, previousState: string | null): Promise<string | null> => {
    const result = await saveAgencyLicense({ agencyId: agency.id, licenses, previousState, values });
    if (!result.ok) return result.message;
    setAgency(result.agency);
    setLicenses(result.licenses);
    return null;
  };

  const removeLicense = async (state: string): Promise<string | null> => {
    const result = await removeAgencyLicense({ agencyId: agency.id, licenses, state });
    if (!result.ok) return result.message;
    setAgency(result.agency);
    setLicenses(result.licenses);
    return null;
  };

  /** Adds or edits one of the agency's contracts through the API. Resolves with the dialog's errors, if any. */
  const saveContract = async (values: AgencyContractValues): Promise<AgencyContractError[]> => {
    const editingId = contractEditor?.mode === "edit" ? contractEditor.contract.id : undefined;
    const result = await saveAgencyContract(agency.id, values, editingId);
    if (!result.ok) return result.errors;
    setContracts((current) =>
      [...(current ?? []).filter((contract) => contract.id !== result.contract.id), result.contract].sort((a, b) =>
        a.carrierName.localeCompare(b.carrierName),
      ),
    );
    return [];
  };

  const addLicenseButton = (
    <button type="button" onClick={() => setLicenseEditor({ mode: "add" })} className={PROFILE_BUTTON_CLASS}>
      <span aria-hidden="true">+</span> Add<span className="sr-only"> licence</span>
    </button>
  );

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
        <StateLicensesPanel
          licenses={licenses}
          showLines
          className="xl:col-span-2"
          action={addLicenseButton}
          onEdit={(license) => setLicenseEditor({ mode: "edit", license })}
        />

        {contracts ? (
          <Panel
            title="Contracts"
            count={contracts.length}
            className="xl:col-span-2"
            action={
              <button
                type="button"
                onClick={() => setContractEditor({ mode: "add" })}
                className={PROFILE_BUTTON_CLASS}
              >
                <span aria-hidden="true">+ </span>Add contract
              </button>
            }
          >
            {contracts.length === 0 ? (
              <PanelEmpty>No carrier contracts recorded.</PanelEmpty>
            ) : (
              <ProfileTable columns={CONTRACT_COLUMNS} rows={contracts} rowKey={(contract) => contract.id}>
                {(contract) => (
                  <>
                    <td className="px-3 py-1.5 align-middle whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setContractEditor({ mode: "edit", contract })}
                        className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
                      >
                        <EditIcon className="size-3.5 shrink-0" />
                        <span className="sr-only"> {contract.carrierName} contract</span>
                      </button>
                    </td>
                    <td className="min-w-0 truncate px-3 py-2.5 align-middle font-medium sm:whitespace-nowrap">
                      <Link href={`/carriers/${contract.carrierId}`} className={PROFILE_LINK_CLASS}>
                        {contract.carrierName}
                      </Link>
                    </td>
                    <td className="min-w-0 truncate px-3 py-2.5 align-middle">
                      {contract.contractNumber ? (
                        <span className="font-mono text-fg">{contract.contractNumber}</span>
                      ) : (
                        <span className="text-fg-subtle">No number yet</span>
                      )}
                    </td>
                    <td className="min-w-0 px-3 py-2.5 align-middle text-fg-muted">
                      {contract.policyTypes.length > 0 ? (
                        contract.policyTypes.map((policyType) => policyType.name).join(", ")
                      ) : (
                        <span className="text-fg-subtle">None</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <StatusBadge status={contract.status} />
                    </td>
                  </>
                )}
              </ProfileTable>
            )}
          </Panel>
        ) : null}

        <Panel
          title="Agents"
          count={agents.length}
          className="xl:col-span-2"
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
                  <td className="min-w-0 px-3 py-2.5 align-middle">
                    {agent.carriers.length > 0 ? (
                      <ul aria-label={`Carriers ${agent.name} is appointed with`} className="flex flex-wrap gap-1">
                        {agent.carriers.map((carrier) => (
                          <li
                            key={carrier}
                            className="rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-fg-muted ring-1 ring-inset ring-line"
                          >
                            {carrier}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-fg-faint">No carriers yet</p>
                    )}
                  </td>
                </>
              )}
            </ProfileTable>
          )}
        </Panel>

        <AgencyNotesPanel
          agencyId={agency.id}
          initialComments={comments}
          canWrite={canWriteNotes}
          className="xl:col-span-2"
        />

        <Panel title="History" count={notes.length} className="xl:col-span-2">
          {/* Cancels NoteList's own top margin; the panel body already pads. */}
          <div className="-mt-2">
            <HydratedNoteList notes={notes} labels={AGENCY_FIELD_LABELS} />
          </div>
        </Panel>
      </div>

      <AgencyDialog editing={editing} onSave={saveEdit} onClose={() => setEditing(null)} />
      <AgencyLicenseDialog
        editor={licenseEditor}
        licensedStates={agency.licensedStates}
        agents={canLicenseAgents ? agents : null}
        onSave={saveLicense}
        onRemove={removeLicense}
        onClose={() => setLicenseEditor(null)}
      />
      {contracts ? (
        <AgencyContractDialog
          editor={contractEditor}
          carriers={carriers}
          contractedCarrierIds={contracts.map((contract) => contract.carrierId)}
          policyTypes={policyTypes}
          agents={agents}
          appointments={appointments}
          onSave={saveContract}
          onAddPolicyType={addPolicyType}
          onClose={() => setContractEditor(null)}
        />
      ) : null}
    </div>
  );
}
