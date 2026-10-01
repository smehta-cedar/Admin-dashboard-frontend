import type { Metadata } from "next";
import { getAgentHome } from "@/lib/agent-home";
import { AgentProfile, type SectionKey } from "../(dashboard)/agents/[id]/agent-profile";

export const metadata: Metadata = {
  title: "My profile",
};

/**
 * The agent view: the same profile staff open at /agents/[id], read-only,
 * with only the sections the role named "Agent" grants (Agent view / My ...).
 * The layout has already required an agent sign-in. Staff who open this
 * address are sent back to the CRM from that layout.
 */
export default async function AgentPage() {
  const home = await getAgentHome();
  if (!home) {
    return (
      <p className="text-sm text-fg-muted">Your profile isn&apos;t available. Ask the office to check your sign-in.</p>
    );
  }
  const { sections } = home;
  const hidden: SectionKey[] = [
    ...(sections.profile ? [] : ["details" as const]),
    ...(sections.contracts ? [] : ["carriers" as const]),
    ...(sections.licenses ? [] : ["licences" as const]),
  ];
  return (
    <AgentProfile
      readOnly
      hiddenSections={hidden}
      initialAgent={home.agent}
      carriers={home.carriers}
      initialContracts={home.contracts ?? []}
      initialLicenses={home.licenses}
      // Null when the Agent role doesn't grant the section: it stays out of the list.
      initialCertifications={home.certifications}
      certificationCarriers={[]}
      passwords={home.passwords?.map((record) => ({ ...record, partyName: record.carrierName })) ?? null}
      // Not in the agent's payload.
      notes={null}
    />
  );
}
