import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { AgentsView } from "./agents-view";

export const metadata: Metadata = {
  title: "Agents",
};

/** The data comes from the section's layout (./layout.tsx), through the agents store. */
export default async function AgentsPage() {
  if (!(await canViewModule("agents"))) return <NoAccess title="Agents" />;
  return <AgentsView />;
}
