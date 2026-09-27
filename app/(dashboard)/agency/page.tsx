import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getAgencyNotes, getAgencyWithLicenses } from "@/lib/agency";
import { getAgencyContracts } from "@/lib/agency-contracts";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getAllCarrierPolicies } from "@/lib/carrier-policies";
import { getCarriers } from "@/lib/carriers";
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
  // A role that can't see agency contracts (a 403) gets null: the panel hides.
  const [notes, contracts] = await Promise.all([
    getAgencyNotes(agency.id),
    allowForbidden(getAgencyContracts(agency.id)),
  ]);
  // The contract dialog's carrier and policy pickers; empty when the role can't see carriers.
  const [carriers, policies] = contracts
    ? await Promise.all([allowForbidden(getCarriers()), allowForbidden(getAllCarrierPolicies())])
    : [null, null];

  return (
    <AgencyProfile
      initialAgency={agency}
      notes={notes}
      initialLicenses={licenses}
      initialContracts={contracts}
      carriers={(carriers ?? []).map(({ id, name, status }) => ({ id, name, status }))}
      policies={(policies ?? []).map(({ id, carrierId, name, status }) => ({ id, carrierId, name, status }))}
      // The roster panel: every agent, read-only here, sorted by name.
      agents={agents
        .map(({ id, name, status, licensedStates }) => ({ id, name, status, licensedStates }))
        .sort((a, b) => a.name.localeCompare(b.name))}
    />
  );
}
