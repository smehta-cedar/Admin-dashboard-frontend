import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getAgencyNotes, getAgencyWithLicenses } from "@/lib/agency";
import { getAgents } from "@/lib/agents";
import { AgencyProfile } from "./agency-profile";

export const metadata: Metadata = {
  title: "Agency",
};

export default async function AgencyPage() {
  const [loaded, agents] = await Promise.all([getAgencyWithLicenses(), getAgents()]);

  if (!loaded) {
    return (
      <>
        <PageHeader title="Agency" />
        <EmptyState
          title="No agency yet"
          description="The API has no agency record. Seed one with `python manage.py seed_agency`, or add it in the Django admin."
        />
      </>
    );
  }

  const { agency, licenses } = loaded;
  const notes = await getAgencyNotes(agency.id);

  return (
    <AgencyProfile
      initialAgency={agency}
      notes={notes}
      initialLicenses={licenses}
      // The roster panel: every agent, read-only here, sorted by name.
      agents={agents
        .map(({ id, name, status, licensedStates }) => ({ id, name, status, licensedStates }))
        .sort((a, b) => a.name.localeCompare(b.name))}
    />
  );
}
