import type { Metadata } from "next";
import { getAgents } from "@/lib/agents";
import { getContracts } from "@/lib/contracts";
import { ContractsView } from "./contracts-view";

export const metadata: Metadata = {
  title: "Contracts",
};

export default async function ContractsPage() {
  const [contracts, agents] = await Promise.all([getContracts(), getAgents()]);

  return <ContractsView initialContracts={contracts} agents={agents} />;
}
