import type { Metadata } from "next";
import { getAgency, getAgencyNotes } from "@/lib/agency";
import { getAgents } from "@/lib/agents";
import { AgencyProfile } from "./agency-profile";

export const metadata: Metadata = {
  title: "Agency",
};

export default async function AgencyPage() {
  const [agency, notes, agents] = await Promise.all([getAgency(), getAgencyNotes(), getAgents()]);

  return (
    <AgencyProfile
      initialAgency={agency}
      initialNotes={notes}
      // The roster panel: every agent, read-only here, sorted by name.
      agents={agents
        .map(({ id, name, status, licensedStates }) => ({ id, name, status, licensedStates }))
        .sort((a, b) => a.name.localeCompare(b.name))}
    />
  );
}
