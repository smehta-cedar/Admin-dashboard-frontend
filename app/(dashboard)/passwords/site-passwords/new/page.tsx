import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canModule } from "@/lib/access";
import { getAgency } from "@/lib/agency";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getSites } from "@/lib/site-passwords";
import { passwordsListHref } from "../../return-to";
import { SitePasswordFormPage } from "../../site-password-form";

export const metadata: Metadata = {
  title: "Add site password",
};

type NewSitePasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Add site password as a page. `agent=<id>` (or `agent=agency`) and
 * `site=<id>` start the form on that agent and site; Cancel and a successful
 * save return to the Passwords list with the same agent filter.
 */
export default async function NewSitePasswordPage(props: NewSitePasswordPageProps) {
  if (!(await canModule("passwords", "create"))) return <NoAccess title="Add site password" />;
  const { agent, site } = await props.searchParams;
  const [agents, sites, agencyRecord] = await Promise.all([getAgents(), getSites(), allowForbidden(getAgency())]);

  return (
    <SitePasswordFormPage
      agents={agents.map(({ id, name, status }) => ({ id, name, status }))}
      sites={sites}
      agency={agencyRecord ? { id: agencyRecord.id, name: agencyRecord.name } : null}
      presetAgentId={typeof agent === "string" ? agent : undefined}
      presetSiteId={typeof site === "string" ? site : undefined}
      returnTo={passwordsListHref(agent)}
    />
  );
}
