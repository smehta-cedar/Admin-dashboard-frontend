import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAgent, getAgentNotes, getAgents } from "@/lib/agents";
import { getCarrierContractNotes, getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { getLogins } from "@/lib/logins";
import { byName } from "@/lib/text";
import { AgentProfile } from "./agent-profile";

export async function generateMetadata(props: PageProps<"/agents/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const agent = await getAgent(id);
  return { title: agent ? agent.name : "Agent not found" };
}

export default async function AgentProfilePage(props: PageProps<"/agents/[id]">) {
  const { id } = await props.params;
  const agent = await getAgent(id);
  if (!agent) notFound();

  const [agents, notes, carrierContracts, contractNotes, logins, carriers] = await Promise.all([
    getAgents(),
    getAgentNotes(),
    getCarrierContracts(),
    getCarrierContractNotes(),
    getLogins(),
    getCarriers(),
  ]);

  const carriersById = new Map(carriers.map((carrier) => [carrier.id, carrier]));
  const carrierName = (carrierId: string) => carriersById.get(carrierId)?.name ?? `Carrier ${carrierId}`;

  return (
    <AgentProfile
      // The profile keeps the agent in state (it can be edited there), so a
      // switch to another agent has to start that state again.
      key={agent.id}
      initialAgent={agent}
      allAgents={agents.map(({ id, name, status, npn }) => ({ id, name, status, npn }))}
      // Every carrier, so Add carrier can appoint this agent to any of them. The
      // profile picks out this agent's contracts; states come only from those
      // appointments, as there are no carrier-less licenses.
      carriers={carriers
        .map(({ id, name, status, availableStates }) => ({ id, name, status, availableStates }))
        .sort(byName)}
      initialContracts={carrierContracts}
      initialContractNotes={contractNotes}
      logins={logins
        .filter((login) => login.agentId === id)
        .map((login) => ({
          ...login,
          partyName: carrierName(login.carrierId),
          partyHref: `/carriers/${login.carrierId}`,
        }))
        .sort((a, b) => a.partyName.localeCompare(b.partyName))}
      initialNotes={notes}
    />
  );
}
