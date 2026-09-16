import type { Metadata } from "next";
import { getAgents } from "@/lib/agents";
import { getContractNotes, getContracts } from "@/lib/contracts";
import { ContractsView } from "./contracts-view";

export const metadata: Metadata = {
  title: "Contracts",
};

export default async function ContractsPage() {
  const [contracts, notes, agents] = await Promise.all([
    getContracts(),
    getContractNotes(),
    getAgents(),
  ]);

  return <ContractsView initialContracts={contracts} initialNotes={notes} agents={agents} />;
}
