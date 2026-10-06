import type { Metadata } from "next";
import { connection } from "next/server";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getAgency } from "@/lib/agency";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCarriers } from "@/lib/carriers";
import { getPasswords } from "@/lib/passwords";
import { PasswordsView } from "./passwords-view";

export const metadata: Metadata = {
  title: "Passwords",
};

export default async function PasswordsPage() {
  if (!(await canViewModule("passwords"))) return <NoAccess title="Passwords" />;
  // The carrier filter (?carrier=) reads search params with useSearchParams.
  // Rendering per request lets the server render the filtered table; a
  // prerendered page would need a Suspense boundary and render the whole table
  // on the client instead.
  await connection();

  const [passwords, agencyRecord, agents, carriers] = await Promise.all([
    getPasswords(),
    allowForbidden(getAgency()),
    getAgents(),
    getCarriers(),
  ]);
  // The agency, for its own passwords. A role that can't read the agency still
  // gets it from an agency password it can see.
  const agencyPassword = passwords.find((password) => password.agencyId);
  const agency = agencyRecord
    ? { id: agencyRecord.id, name: agencyRecord.name }
    : agencyPassword?.agencyId
      ? { id: agencyPassword.agencyId, name: agencyPassword.agentName }
      : null;

  return (
    <PasswordsView
      initialPasswords={passwords}
      agency={agency}
      agents={agents.map(({ id, name, status }) => ({ id, name, status }))}
      carriers={carriers.map(({ id, name, status, agentAccessible }) => ({ id, name, status, agentAccessible }))}
    />
  );
}
