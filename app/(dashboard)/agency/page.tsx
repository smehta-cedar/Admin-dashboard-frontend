import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getAgencyNotes, getAgencyWithLicenses } from "@/lib/agency";
import { getAgencyContracts } from "@/lib/agency-contracts";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCarriers } from "@/lib/carriers";
import { getPolicyTypes } from "@/lib/policy-types";
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
  // The contract dialog's carrier and policy type pickers; empty when the role can't see them.
  const [carriers, policyTypes] = contracts
    ? await Promise.all([allowForbidden(getCarriers()), allowForbidden(getPolicyTypes())])
    : [null, null];

  return (
    <AgencyProfile
      initialAgency={agency}
      notes={notes}
      initialLicenses={licenses}
      initialContracts={contracts}
      carriers={(carriers ?? []).map(({ id, name, status }) => ({ id, name, status }))}
      policyTypes={(policyTypes ?? []).map(({ id, name, status }) => ({ id, name, status }))}
      // The roster panel: every agent, read-only here, sorted by name.
      agents={agents
        .map(({ id, name, status, licensedStates }) => ({ id, name, status, licensedStates }))
        .sort((a, b) => a.name.localeCompare(b.name))}
    />
  );
}
