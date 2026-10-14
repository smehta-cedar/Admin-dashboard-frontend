import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import { canModule } from "@/lib/access";
import { getAgency } from "@/lib/agency";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCarriers } from "@/lib/carriers";
import { getPassword } from "@/lib/passwords";
import { PasswordFormPage } from "../../password-form";
import { passwordReturnTo } from "../../return-to";

type EditPasswordPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(props: EditPasswordPageProps): Promise<Metadata> {
  const { id } = await props.params;
  if (!(await canModule("passwords", "update"))) return { title: "No access" };
  const password = await getPassword(id);
  return { title: password ? `Edit ${password.agentName} at ${password.carrierName}` : "Password not found" };
}

/**
 * Edit carrier password as a page, in the same layout as Add. `from=agent`
 * returns to the password's agent's profile; otherwise the list, keeping its
 * `agent=` and `carrier=` filters when there were any.
 */
export default async function EditPasswordPage(props: EditPasswordPageProps) {
  if (!(await canModule("passwords", "update"))) return <NoAccess title="Edit password" />;
  const { id } = await props.params;
  const { agent, carrier, from } = await props.searchParams;
  const [password, agents, carriers, agencyRecord] = await Promise.all([
    getPassword(id),
    getAgents(),
    getCarriers(),
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
    <PasswordFormPage
      password={password}
      agents={agents.map(({ id: agentId, name, status }) => ({ id: agentId, name, status }))}
      carriers={carriers.map(({ id: carrierId, name, status, agentAccessible }) => ({ id: carrierId, name, status, agentAccessible }))}
      agency={agency}
      returnTo={
        from === "agent"
          ? passwordReturnTo(from, password.agentId ?? undefined)
          : passwordReturnTo(undefined, agent, carrier)
      }
    />
  );
}
