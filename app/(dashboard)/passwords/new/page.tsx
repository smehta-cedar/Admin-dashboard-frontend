import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canModule } from "@/lib/access";
import { getAgency } from "@/lib/agency";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCarriers } from "@/lib/carriers";
import { PasswordFormPage } from "../password-form";
import { passwordReturnTo } from "../return-to";

export const metadata: Metadata = {
  title: "Add carrier password",
};

type NewPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Add password as a page rather than a dialog. The static `new` segment wins
 * over the dynamic `[id]` beside it. `agent=<id>` (or `agent=agency`) and
 * `carrier=<id>` start the form on that agent and carrier; `from=agent`
 * returns to their profile, otherwise Cancel and a successful save return to
 * the list with the same filters.
 */
export default async function NewPasswordPage(props: NewPasswordPageProps) {
  if (!(await canModule("passwords", "create"))) return <NoAccess title="Add carrier password" />;
  const { agent, carrier, from } = await props.searchParams;
  const [agents, carriers, agencyRecord] = await Promise.all([
    getAgents(),
    getCarriers(),
    allowForbidden(getAgency()),
  ]);

  return (
    <PasswordFormPage
      agents={agents.map(({ id, name, status }) => ({ id, name, status }))}
      carriers={carriers.map(({ id, name, status, agentAccessible }) => ({ id, name, status, agentAccessible }))}
      agency={agencyRecord ? { id: agencyRecord.id, name: agencyRecord.name } : null}
      presetAgentId={typeof agent === "string" ? agent : undefined}
      presetCarrierId={typeof carrier === "string" ? carrier : undefined}
      returnTo={passwordReturnTo(from, agent, carrier)}
    />
  );
}
