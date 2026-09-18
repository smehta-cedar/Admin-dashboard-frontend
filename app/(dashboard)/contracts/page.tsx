import type { Metadata } from "next";
import { getAgency } from "@/lib/agency";
import { getAgents } from "@/lib/agents";
import { getCarrierContractNotes, getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { ContractsView } from "./contracts-view";

export const metadata: Metadata = {
  title: "Contracts",
};

export default async function ContractsPage() {
  const [contracts, notes, agents, carriers, agency] = await Promise.all([
    getCarrierContracts(),
    getCarrierContractNotes(),
    getAgents(),
    getCarriers(),
    getAgency(),
  ]);

  // Where an agent can write needs both ceilings: their own licences and the
  // carrier's footprint. Active agents only; status is edited on the Agents page.
  return (
    <ContractsView
      initialContracts={contracts}
      initialNotes={notes}
      agents={agents
        .filter((agent) => agent.status === "active")
        .map(({ id, name, licensedStates, licenseNumbers }) => ({
          id,
          name,
          licensedStates,
          licenseNumbers,
        }))}
      carriers={carriers.map(({ id, name, status, availableStates }) => ({
        id,
        name,
        status,
        availableStates,
      }))}
      agencyLicenseNumbers={agency.licenseNumbers}
    />
  );
}
