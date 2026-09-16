import type { Metadata } from "next";
import { getAgents } from "@/lib/agents";
import { getCarrierContractNotes, getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { CarrierContractsView } from "./carrier-contracts-view";

export const metadata: Metadata = {
  title: "Contracts by carrier",
};

export default async function ContractsByCarrierPage() {
  const [contracts, notes, agents, carriers] = await Promise.all([
    getCarrierContracts(),
    getCarrierContractNotes(),
    getAgents(),
    getCarriers(),
  ]);

  return (
    <CarrierContractsView
      initialContracts={contracts}
      initialNotes={notes}
      // Contracts show active agents only; status is edited on the Agents page.
      agents={agents
        .filter((agent) => agent.status === "active")
        .map(({ id, name }) => ({ id, name }))}
      carriers={carriers.map(({ id, name, linesOfBusiness, status }) => ({
        id,
        name,
        linesOfBusiness,
        status,
      }))}
    />
  );
}
