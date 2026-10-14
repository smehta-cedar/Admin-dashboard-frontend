import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import { canModule } from "@/lib/access";
import { getAgency } from "@/lib/agency";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getSitePassword, getSites } from "@/lib/site-passwords";
import { passwordsListHref } from "../../../return-to";
import { SitePasswordFormPage } from "../../../site-password-form";

type EditSitePasswordPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(props: EditSitePasswordPageProps): Promise<Metadata> {
  const { id } = await props.params;
  if (!(await canModule("passwords", "update"))) return { title: "No access" };
  const password = await getSitePassword(id);
  return { title: password ? `Edit ${password.agentName} at ${password.siteName}` : "Password not found" };
}

/** Edit site password as a page. Returns to the Passwords list, keeping its `agent=` filter. */
export default async function EditSitePasswordPage(props: EditSitePasswordPageProps) {
  if (!(await canModule("passwords", "update"))) return <NoAccess title="Edit site password" />;
  const { id } = await props.params;
  const { agent } = await props.searchParams;
  const [password, agents, sites, agencyRecord] = await Promise.all([
    getSitePassword(id),
    getAgents(),
    getSites(),
    allowForbidden(getAgency()),
  ]);
  if (!password) notFound();

  // A role that can't read the agency still gets it from the agency's own password.
  const agency = agencyRecord
    ? { id: agencyRecord.id, name: agencyRecord.name }
    : password.agencyId
      ? { id: password.agencyId, name: password.agentName }
      : null;

  return (
    <SitePasswordFormPage
      password={password}
      agents={agents.map(({ id: agentId, name, status }) => ({ id: agentId, name, status }))}
      sites={sites}
      agency={agency}
      returnTo={passwordsListHref(agent)}
    />
  );
}
