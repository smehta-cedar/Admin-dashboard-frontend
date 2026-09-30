import type { Metadata } from "next";
import { getContractedCarriers } from "@/lib/agency-contracts";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCertifications } from "@/lib/certifications";
import { getPolicyTypes } from "@/lib/policy-types";
import { PolicyTypesView } from "./policy-types-view";

export const metadata: Metadata = {
  title: "Policy types",
};

export default async function PolicyTypesPage() {
  const [policyTypes, certifications, agents, contractedCarriers] = await Promise.all([
    getPolicyTypes(),
    // Null for a role without certifications view: rows then don't expand.
    allowForbidden(getCertifications()),
    // Every agent, for the certification dialog's select; none when the role can't see agents.
    allowForbidden(getAgents()),
    // Carriers a type can require certification for; null when the role can't see agency contracts.
    allowForbidden(getContractedCarriers()),
  ]);

  return (
    <PolicyTypesView
      initialPolicyTypes={policyTypes}
      initialCertifications={certifications}
      agents={(agents ?? []).map(({ id, name, status }) => ({ id, name, status }))}
      contractedCarriers={contractedCarriers}
    />
  );
}
