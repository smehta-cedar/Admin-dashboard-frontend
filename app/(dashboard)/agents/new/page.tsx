import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canModule } from "@/lib/access";
import { allowForbidden } from "@/lib/api-server";
import { getCarriers } from "@/lib/carriers";
import { certifiableCarrier } from "@/lib/certification-options";
import { NewAgentView } from "./new-agent-view";

export const metadata: Metadata = {
  title: "Add agent",
};

/**
 * Add agent as a page rather than a dialog. The static `new` segment wins
 * over the dynamic `[id]` beside it. The form and its save come from the
 * section's store (../agents-store.tsx), so the new agent is in the list on
 * the way back. Carriers (with their lines of business) feed the
 * certification rows.
 */
export default async function NewAgentPage() {
  if (!(await canModule("agents.list", "create"))) return <NoAccess title="Add agent" />;
  // Empty when the role can't read carriers.
  const carriers = (await allowForbidden(getCarriers())) ?? [];
  return <NewAgentView carriers={carriers.map(certifiableCarrier)} />;
}
