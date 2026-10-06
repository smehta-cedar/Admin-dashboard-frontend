import { notFound, redirect } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getAgents } from "@/lib/agents";

/** The sidebar's "Agent profile" link: opens the first active agent. */
export default async function AgentProfileIndexPage() {
  if (!(await canViewModule("agents"))) return <NoAccess title="Agent profile" />;
  const agents = await getAgents();
  const agent = agents.find((a) => a.status === "active") ?? agents[0];
  if (!agent) notFound();
  redirect(`/agents/${agent.id}`);
}
