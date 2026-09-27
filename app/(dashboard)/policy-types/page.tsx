import type { Metadata } from "next";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCertifications } from "@/lib/certifications";
import { getPolicyTypes } from "@/lib/policy-types";
import { PolicyTypesView } from "./policy-types-view";

export const metadata: Metadata = {
  title: "Policy types",
};

export default async function PolicyTypesPage() {
  const [policyTypes, certifications, agents] = await Promise.all([
    getPolicyTypes(),
    // Null for a role without certifications view: rows then don't expand.
    allowForbidden(getCertifications()),
    // Every agent, for the certification dialog's select; none when the role can't see agents.
    allowForbidden(getAgents()),
  ]);

  return (
    <PolicyTypesView
      initialPolicyTypes={policyTypes}
      initialCertifications={certifications}
      agents={(agents ?? []).map(({ id, name, status }) => ({ id, name, status }))}
    />
  );
}
