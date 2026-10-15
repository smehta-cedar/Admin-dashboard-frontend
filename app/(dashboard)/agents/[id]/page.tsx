import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getAgency } from "@/lib/agency";
import { getAgent, getAgentNotes, getAgentWithLicenses } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { certifiableCarrier } from "@/lib/certification-options";
import { getCertifications } from "@/lib/certifications";
import { getPasswords } from "@/lib/passwords";
import { getSitePasswords, getSites } from "@/lib/site-passwords";
import { byName } from "@/lib/text";
import { AgentProfile } from "./agent-profile";

export async function generateMetadata(props: PageProps<"/agents/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!(await canViewModule("agents.profile"))) return { title: "No access" };
  const agent = await getAgent(id);
  return { title: agent ? agent.name : "Agent not found" };
}

export default async function AgentProfilePage(props: PageProps<"/agents/[id]">) {
  if (!(await canViewModule("agents.profile"))) return <NoAccess title="Agent profile" />;
  const { id } = await props.params;
  const loaded = await getAgentWithLicenses(id);
  if (!loaded) notFound();
  const { agent, licenses } = loaded;

  // Each side load is null for a role that can't see it (a 403): the profile
  // hides that section, or shows the rest without it.
  const [notes, carrierContracts, passwords, sitePasswords, sites, carriers, certifications, agency] = await Promise.all([
    allowForbidden(getAgentNotes(id)),
    allowForbidden(getCarrierContracts()),
    allowForbidden(getPasswords()),
    allowForbidden(getSitePasswords()),
    // For the Add site password popup's Site select.
    allowForbidden(getSites()),
    allowForbidden(getCarriers()).then((list) => list ?? []),
    allowForbidden(getCertifications({ agentId: id })),
    // Null for a role without agency view: the maps then disable nothing.
    allowForbidden(getAgency()),
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
        .map(({ id, name, status, availableStates, agentAccessible, licenses }) => ({
          id,
          name,
          status,
          availableStates,
          agentAccessible,
          // Each state's Life / Health lines, for the Carriers map's badges.
          licenses,
        }))
        .sort(byName)}
      initialContracts={carrierContracts ?? []}
      initialLicenses={licenses}
      initialCertifications={certifications}
      certificationCarriers={carriers.map(certifiableCarrier)}
      passwords={
        passwords
          ?.filter((record) => record.agentId === id)
          .sort((a, b) => a.carrierName.localeCompare(b.carrierName)) ?? null
      }
      sitePasswords={
        sitePasswords
          ?.filter((record) => record.agentId === id)
          .sort((a, b) => a.siteName.localeCompare(b.siteName, undefined, { sensitivity: "base" })) ?? null
      }
      sites={sites ?? []}
      notes={notes}
      agencyLicensedStates={agency ? agency.licensedStates : null}
    />
  );
}
