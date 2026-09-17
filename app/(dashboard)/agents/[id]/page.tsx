import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAgent, getAgentNotes, getAgents } from "@/lib/agents";
import { getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { getLogins } from "@/lib/logins";
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

  const [agents, notes, carrierContracts, logins, carriers] = await Promise.all([
    getAgents(),
    getAgentNotes(),
    getCarrierContracts(),
    getLogins(),
    getCarriers(),
  ]);

  const carriersById = new Map(carriers.map((carrier) => [carrier.id, carrier]));
  const carrierName = (carrierId: string) => carriersById.get(carrierId)?.name ?? `Carrier ${carrierId}`;
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

  return (
    <AgentProfile
      agent={agent}
      allAgents={agents.map(({ id, name, status }) => ({ id, name, status })).sort(byName)}
      // States come only from carrier appointments; there are no carrier-less licenses.
      carriers={carrierContracts
        .filter((contract) => contract.agentId === id)
        .flatMap((contract) => {
          const carrier = carriersById.get(contract.carrierId);
          return carrier
            ? [
                {
                  id: carrier.id,
                  name: carrier.name,
                  status: carrier.status,
                  appointedStates: [...new Set(contract.appointedStates)].sort(),
                },
              ]
            : [];
        })
        .sort(byName)}
      logins={logins
        .filter((login) => login.agentId === id)
        .map((login) => ({ ...login, carrierName: carrierName(login.carrierId) }))
        .sort((a, b) => a.carrierName.localeCompare(b.carrierName))}
      notes={notes.filter((note) => note.agentId === id)}
    />
  );
}
