import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAgent, getAgentNotes, getAgentWithLicenses } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { certifiableCarrier } from "@/lib/certification-options";
import { getCertifications } from "@/lib/certifications";
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

  const [notes, carrierContracts, passwords, carriers, certifications] = await Promise.all([
    getAgentNotes(id),
    getCarrierContracts(),
    getPasswords(),
    getCarriers(),
    // Null for a role without certifications view: the profile then hides the section.
    allowForbidden(getCertifications({ agentId: id })),
  ]);

  return (
    <AgentProfile
      // A switch to another agent starts the profile's state again. Edit is
      // a separate page, so a saved agent comes back through this load.
      key={agent.id}
      initialAgent={agent}
      // Every carrier, so Add carrier can appoint this agent to any of them. The
      // profile picks out this agent's contracts; states come only from those
      // appointments, as there are no carrier-less licenses.
      carriers={carriers
        .map(({ id, name, status, availableStates, agentAccessible }) => ({
          id,
          name,
          status,
          availableStates,
          agentAccessible,
        }))
        .sort(byName)}
      initialContracts={carrierContracts}
      initialLicenses={licenses}
      initialCertifications={certifications}
      certificationCarriers={carriers.map(certifiableCarrier)}
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
