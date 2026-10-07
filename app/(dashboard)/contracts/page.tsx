import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getAgency } from "@/lib/agency";
import { getAgents } from "@/lib/agents";
import { getCarrierContractNotes, getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { ContractsView } from "./contracts-view";

export const metadata: Metadata = {
  title: "Contracts",
};

export default async function ContractsPage() {
  if (!(await canViewModule("contracts"))) return <NoAccess title="Contracts" />;
  const [contracts, notes, agents, carriers, agency] = await Promise.all([
    getCarrierContracts(),
    getCarrierContractNotes(),
    getAgents(),
    getCarriers(),
    getAgency(),
  ]);

  // Where an agent can write needs both ceilings: their own licences and the
  // carrier's footprint. Every agent: inactive ones are shown marked and left
  // out of the counts (status is edited on the Agents page).
  return (
    <ContractsView
      initialContracts={contracts}
      notes={notes}
      agents={agents.map(({ id, name, status, licensedStates, licenseNumbers }) => ({
        id,
        name,
        status,
        licensedStates,
        licenseNumbers,
      }))}
      carriers={carriers.map(({ id, name, status, availableStates, agentAccessible }) => ({
        id,
        name,
        status,
        availableStates,
        agentAccessible,
      }))}
      agencyLicenseNumbers={agency?.licenseNumbers ?? {}}
    />
  );
}
