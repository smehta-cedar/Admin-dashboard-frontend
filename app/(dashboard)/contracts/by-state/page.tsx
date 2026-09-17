import type { Metadata } from "next";
import { getAgents } from "@/lib/agents";
import { getCarrierContractNotes, getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { ContractsView } from "./contracts-view";

export const metadata: Metadata = {
  title: "Contracts by state",
};

export default async function ContractsByStatePage() {
  const [contracts, notes, agents, carriers] = await Promise.all([
    getCarrierContracts(),
    getCarrierContractNotes(),
    getAgents(),
    getCarriers(),
  ]);

  // States come from carrier appointments. Active agents only; status is edited on the Agents page.
  return (
    <ContractsView
      initialContracts={contracts}
      initialNotes={notes}
      agents={agents
        .filter((agent) => agent.status === "active")
        .map(({ id, name }) => ({ id, name }))}
      carriers={carriers.map(({ id, name, status, availableStates }) => ({
        id,
        name,
        status,
        availableStates,
      }))}
    />
  );
}
