import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAgentWithLicenses } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCertifications } from "@/lib/certifications";
import { getPolicyTypes } from "@/lib/policy-types";
import { AgentFormPage } from "../../agent-form-page";
import { draftFromCertification } from "../../new/certificate-draft";

type EditAgentPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(props: EditAgentPageProps): Promise<Metadata> {
  const { id } = await props.params;
  const loaded = await getAgentWithLicenses(id);
  return { title: loaded ? `Edit ${loaded.agent.name}` : "Agent not found" };
}

/**
 * Edit agent as a page, in the same layout as Add agent. `from=list` returns
 * to the agents list; anything else returns to this agent's profile.
 */
export default async function EditAgentPage(props: EditAgentPageProps) {
  const { id } = await props.params;
  const { from } = await props.searchParams;
  const loaded = await getAgentWithLicenses(id);
  if (!loaded) notFound();

  const [policyTypes, certifications] = await Promise.all([
    allowForbidden(getPolicyTypes()),
    allowForbidden(getCertifications({ agentId: id })),
  ]);
  const canCertify = policyTypes != null && certifications != null;

  return (
    <AgentFormPage
      agent={loaded.agent}
      policyTypes={
        canCertify ? policyTypes.map(({ id: typeId, name, status }) => ({ id: typeId, name, status })) : null
      }
      initialCertificates={
        canCertify
          ? certifications.map(draftFromCertification)
          : []
      }
      returnTo={from === "list" ? "/agents" : `/agents/${id}`}
    />
  );
}
