import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getAgents } from "@/lib/agents";
import { getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarrierPolicies } from "@/lib/carrier-policies";
import { getCarrier } from "@/lib/carriers";
import { getPasswords } from "@/lib/passwords";
import { getPolicyTypes } from "@/lib/policy-types";
import { byName } from "@/lib/text";
import { CarrierProfile } from "./carrier-profile";

export async function generateMetadata(props: PageProps<"/carriers/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!(await canViewModule("carriers.profile"))) return { title: "No access" };
  const carrier = await getCarrier(id);
  return { title: carrier ? carrier.name : "Carrier not found" };
}

export default async function CarrierProfilePage(props: PageProps<"/carriers/[id]">) {
  if (!(await canViewModule("carriers.profile"))) return <NoAccess title="Carrier profile" />;
  const { id } = await props.params;
  const carrier = await getCarrier(id);
  if (!carrier) notFound();

  const [carrierContracts, passwords, agents, policies, policyTypes] = await Promise.all([
    getCarrierContracts(),
    getPasswords(),
    getAgents(),
    getCarrierPolicies(id),
    getPolicyTypes(),
  ]);

  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

  return (
    <CarrierProfile
      // The profile keeps the carrier's policies in state, so a switch to
      // another carrier has to start that state again.
      key={carrier.id}
      carrier={carrier}
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
                  writingNumber: contract.writingNumber,
                  appointedStates: contract.appointedStates,
                  licensedStates: agent.licensedStates,
                },
              ]
            : [];
        })
        .sort(byName)}
      passwords={passwords
        .filter((record) => record.carrierId === id)
        .sort((a, b) => a.agentName.localeCompare(b.agentName))}
      // The policies live on this carrier; the dialog picks their type from the catalog.
      initialPolicies={policies}
      policyTypes={policyTypes}
    />
  );
}
