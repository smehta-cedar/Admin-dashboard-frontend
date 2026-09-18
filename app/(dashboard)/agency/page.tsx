import type { Metadata } from "next";
import { getAgency, getAgencyNotes } from "@/lib/agency";
import { getAgencyStateLicenses } from "@/lib/agency-state-licenses";
import { getAgents } from "@/lib/agents";
import { AgencyProfile } from "./agency-profile";

export const metadata: Metadata = {
  title: "Agency",
};

export default async function AgencyPage() {
  const [agency, notes, agents, stateLicenses] = await Promise.all([
    getAgency(),
    getAgencyNotes(),
    getAgents(),
    getAgencyStateLicenses(),
  ]);

  return (
    <AgencyProfile
      initialAgency={agency}
      initialNotes={notes}
      // Every row: there is one agency, so they all belong to it.
      initialLicenses={stateLicenses}
      // The roster panel: every agent, read-only here, sorted by name.
      agents={agents
        .map(({ id, name, status, licensedStates }) => ({ id, name, status, licensedStates }))
        .sort((a, b) => a.name.localeCompare(b.name))}
    />
  );
}
