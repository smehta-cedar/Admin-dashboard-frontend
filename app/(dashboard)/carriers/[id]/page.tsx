import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAgents } from "@/lib/agents";
import { getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarrier, getCarrierNotes, getCarriers } from "@/lib/carriers";
import { getLogins } from "@/lib/logins";
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
      // The profile keeps the carrier in state (it can be edited there), so a
      // switch to another carrier has to start that state again.
      key={carrier.id}
      initialCarrier={carrier}
      // Every carrier, so Edit can check name uniqueness against the rest.
      allCarriers={carriers}
      // Appointment + licence inputs stay raw; the profile derives writable
      // against the live availableStates after an edit.
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
                  appointedStates: contract.appointedStates,
                  licensedStates: agent.licensedStates,
                },
              ]
            : [];
        })
        .sort(byName)}
      logins={logins
        .filter((login) => login.carrierId === id)
        .map((login) => ({ ...login, agentName: agentName(login.agentId) }))
        .sort((a, b) => a.agentName.localeCompare(b.agentName))}
      initialNotes={notes}
    />
  );
}
