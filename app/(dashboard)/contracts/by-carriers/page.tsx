import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { CarrierContractsView } from "./carrier-contracts-view";

export const metadata: Metadata = {
  title: "Contracts by carrier",
};

export default async function ContractsByCarrierPage() {
  if (!(await canViewModule("contracts.by_carriers"))) return <NoAccess title="Contracts by carrier" />;
  const [contracts, agents, carriers] = await Promise.all([
    getCarrierContracts(),
    // Other modules' lists: empty when the role can't read them.
    allowForbidden(getAgents()).then((list) => list ?? []),
    allowForbidden(getCarriers()).then((list) => list ?? []),
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
