import type { Metadata } from "next";
import { getAgents } from "@/lib/agents";
import { getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { CarrierContractsView } from "./carrier-contracts-view";

export const metadata: Metadata = {
  title: "Contracts by carrier",
};

export default async function ContractsByCarrierPage() {
  const [contracts, agents, carriers] = await Promise.all([
    getCarrierContracts(),
    getAgents(),
    getCarriers(),
  ]);

  return (
    <CarrierContractsView
      initialContracts={contracts}
      // Every agent: inactive ones are shown marked and left out of the
      // coverage counts (status is edited on the Agents page).
      agents={agents.map(({ id, name, status, licensedStates }) => ({
        id,
        name,
        status,
        licensedStates,
      }))}
      carriers={carriers.map(({ id, name, linesOfBusiness, status, availableStates, agentAccessible }) => ({
        id,
        name,
        linesOfBusiness,
        status,
        availableStates,
        agentAccessible,
      }))}
    />
  );
}
