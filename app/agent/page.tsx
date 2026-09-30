import type { Metadata } from "next";
import { getAgentHome } from "@/lib/agent-home";
import { AgentProfile } from "../(dashboard)/agents/[id]/agent-profile";

export const metadata: Metadata = {
  title: "My profile",
};

/**
 * The agent view: the same profile staff open at /agents/[id], read-only.
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
  return (
    <AgentProfile
      readOnly
      initialAgent={home.agent}
      carriers={home.carriers}
      initialContracts={home.contracts}
      initialLicenses={home.licenses}
      initialCertifications={home.certifications}
      policyTypes={[]}
      // Not in the agent's payload: those sections stay out of the list.
      passwords={null}
      notes={null}
    />
  );
}
