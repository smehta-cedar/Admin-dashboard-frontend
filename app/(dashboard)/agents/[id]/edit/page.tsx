import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getAgentWithLicenses } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCarriers } from "@/lib/carriers";
import { certifiableCarrier } from "@/lib/certification-options";
import { getCertifications } from "@/lib/certifications";
import { AgentFormPage } from "../../agent-form-page";
import { draftFromCertification } from "../../new/certificate-draft";

type EditAgentPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(props: EditAgentPageProps): Promise<Metadata> {
  const { id } = await props.params;
  if (!(await canViewModule("agents"))) return { title: "No access" };
  const loaded = await getAgentWithLicenses(id);
  return { title: loaded ? `Edit ${loaded.agent.name}` : "Agent not found" };
}

/**
 * Edit agent as a page, in the same layout as Add agent. `from=list` returns
 * to the agents list; anything else returns to this agent's profile.
 */
export default async function EditAgentPage(props: EditAgentPageProps) {
  if (!(await canViewModule("agents"))) return <NoAccess title="Edit agent" />;
  const { id } = await props.params;
  const { from } = await props.searchParams;
  const loaded = await getAgentWithLicenses(id);
  if (!loaded) notFound();

  const [carriers, certifications] = await Promise.all([
    getCarriers(),
    // Null for a role without certifications view: the page then leaves the card out.
    allowForbidden(getCertifications({ agentId: id })),
  ]);

  return (
    <AgentFormPage
      agent={loaded.agent}
      carriers={certifications ? carriers.map(certifiableCarrier) : null}
      initialCertificates={certifications ? certifications.map(draftFromCertification) : []}
      returnTo={from === "list" ? "/agents" : `/agents/${id}`}
    />
  );
}
