import type { Metadata } from "next";
import { getAgentStateLicenses } from "@/lib/agent-state-licenses";
import { getAgentNotes, getAgents } from "@/lib/agents";
import { AgentsView } from "./agents-view";

export const metadata: Metadata = {
  title: "Agents",
};

export default async function AgentsPage() {
  const [agents, notes, licenses] = await Promise.all([
    getAgents(),
    getAgentNotes(),
    getAgentStateLicenses(),
  ]);

  return <AgentsView initialAgents={agents} initialNotes={notes} initialLicenses={licenses} />;
}
