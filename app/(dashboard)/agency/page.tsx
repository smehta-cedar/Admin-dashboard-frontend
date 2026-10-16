import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { canModule, canViewModule } from "@/lib/access";
import { getAgencyComments, getAgencyNotes, getAgencyWithLicenses } from "@/lib/agency";
import { getAgencyContracts } from "@/lib/agency-contracts";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { getPolicyTypes } from "@/lib/policy-types";
import { getSessionUser } from "@/lib/session";
import { AgencyProfile } from "./agency-profile";
import { NewAgency } from "./new-agency";

export const metadata: Metadata = {
  title: "Agency",
};

export default async function AgencyPage() {
  if (!(await canViewModule("agencies"))) return <NoAccess title="Agency" />;
  const [loaded, agents] = await Promise.all([getAgencyWithLicenses(), getAgents()]);

  if (!loaded) {
    const user = await getSessionUser();
    return (
      <>
        <PageHeader title="Agency" />
        <NewAgency canAdd={Boolean(user?.isSuperuser)} />
      </>
    );
  }

  const { agency, licenses } = loaded;
  // A role that can't see agency contracts (a 403) gets null: the panel hides.
  const [notes, comments, contracts] = await Promise.all([
    getAgencyNotes(agency.id),
    getAgencyComments(agency.id),
    allowForbidden(getAgencyContracts(agency.id)),
  ]);
  // The contract dialog's carrier and policy type pickers; empty when the role can't see them.
  const [carriers, policyTypes] = contracts
    ? await Promise.all([allowForbidden(getCarriers()), allowForbidden(getPolicyTypes())])
    : [null, null];
  // Every appointment: the Agents table's Carriers column, and who already has a carrier in the
  // contract dialog. Empty when the role can't see contracts.
  const agentContracts = (await allowForbidden(getCarrierContracts())) ?? [];
  // The dialog's Agents boxes appoint agents too, so they need the role to add agent contracts.
  // Null hides the boxes.
  const appointments =
    contracts && (await canModule("contracts", "create"))
      ? agentContracts.map(({ agentId, carrierId }) => ({ agentId, carrierId }))
      : null;

  return (
    <AgencyProfile
      initialAgency={agency}
      notes={notes}
      comments={comments}
      canWriteNotes={await canModule("agencies", "update")}
      initialLicenses={licenses}
      initialContracts={contracts}
      carriers={(carriers ?? []).map(({ id, name, status }) => ({ id, name, status }))}
      policyTypes={(policyTypes ?? []).map(({ id, name, status }) => ({ id, name, status }))}
      appointments={appointments}
      // The licence dialog's Agents boxes edit agents' licences, so they need the role to edit agents.
      canLicenseAgents={await canModule("agents", "update")}
      // The roster panel: every agent with the carriers they're appointed with, read-only here, sorted by name.
      agents={agents
        .map(({ id, name, status, licensedStates }) => ({
          id,
          name,
          status,
          licensedStates,
          carriers: agentContracts
            .filter((contract) => contract.agentId === id)
            .map((contract) => contract.carrierName)
            .sort((a, b) => a.localeCompare(b)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))}
    />
  );
}
