import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAgent, getAgentNotes, getAgentWithLicenses } from "@/lib/agents";
import { getCarrierContractNotes, getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { getPasswords } from "@/lib/passwords";
import { byName } from "@/lib/text";
import { AgentProfile } from "./agent-profile";

export async function generateMetadata(props: PageProps<"/agents/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const agent = await getAgent(id);
  return { title: agent ? agent.name : "Agent not found" };
}

export default async function AgentProfilePage(props: PageProps<"/agents/[id]">) {
  const { id } = await props.params;
  const loaded = await getAgentWithLicenses(id);
  if (!loaded) notFound();
  const { agent, licenses } = loaded;

  const [notes, carrierContracts, contractNotes, passwords, carriers] = await Promise.all([
    getAgentNotes(id),
    getCarrierContracts(),
    getCarrierContractNotes(),
    getPasswords(),
    getCarriers(),
  ]);

  return (
    <AgentProfile
      // The profile keeps the agent in state (it can be edited there), so a
      // switch to another agent has to start that state again.
      key={agent.id}
      initialAgent={agent}
      // Every carrier, so Add carrier can appoint this agent to any of them. The
      // profile picks out this agent's contracts; states come only from those
      // appointments, as there are no carrier-less licenses.
      carriers={carriers
        .map(({ id, name, status, availableStates }) => ({ id, name, status, availableStates }))
        .sort(byName)}
      initialContracts={carrierContracts}
      initialContractNotes={contractNotes}
      initialLicenses={licenses}
      passwords={passwords
        .filter((record) => record.agentId === id)
        .map((record) => ({
          ...record,
          partyName: record.carrierName,
          partyHref: `/carriers/${record.carrierId}`,
        }))
        .sort((a, b) => a.partyName.localeCompare(b.partyName))}
      notes={notes}
    />
  );
}
