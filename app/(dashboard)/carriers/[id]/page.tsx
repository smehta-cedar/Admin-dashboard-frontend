import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAgents } from "@/lib/agents";
import { getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarrier, getCarrierNotes, getCarriers } from "@/lib/carriers";
import { getLogins } from "@/lib/logins";
import { writableStates } from "@/lib/us-states";
import { CarrierProfile } from "./carrier-profile";

export async function generateMetadata(props: PageProps<"/carriers/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const carrier = await getCarrier(id);
  return { title: carrier ? carrier.name : "Carrier not found" };
}

export default async function CarrierProfilePage(props: PageProps<"/carriers/[id]">) {
  const { id } = await props.params;
  const carrier = await getCarrier(id);
  if (!carrier) notFound();

  const [carriers, notes, carrierContracts, logins, agents] = await Promise.all([
    getCarriers(),
    getCarrierNotes(),
    getCarrierContracts(),
    getLogins(),
    getAgents(),
  ]);

  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const agentName = (agentId: string) => agentsById.get(agentId)?.name ?? `Agent ${agentId}`;
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

  return (
    <CarrierProfile
      carrier={carrier}
      allCarriers={carriers.map(({ id, name, status }) => ({ id, name, status })).sort(byName)}
      // States an agent can write here: the appointment within their own
      // licences and this carrier's footprint, not the raw appointment.
      agents={carrierContracts
        .filter((contract) => contract.carrierId === id)
        .flatMap((contract) => {
          const agent = agentsById.get(contract.agentId);
          return agent
            ? [
                {
                  id: agent.id,
                  name: agent.name,
                  status: agent.status,
                  writable: writableStates(
                    contract.appointedStates,
                    agent.licensedStates,
                    carrier.availableStates,
                  ),
                },
              ]
            : [];
        })
        .sort(byName)}
      logins={logins
        .filter((login) => login.carrierId === id)
        .map((login) => ({ ...login, agentName: agentName(login.agentId) }))
        .sort((a, b) => a.agentName.localeCompare(b.agentName))}
      notes={notes.filter((note) => note.carrierId === id)}
    />
  );
}
