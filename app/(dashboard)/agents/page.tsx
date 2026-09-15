import type { Metadata } from "next";
import { getAgentNotes, getAgents } from "@/lib/agents";
import { AgentsView } from "./agents-view";

export const metadata: Metadata = {
  title: "Agents",
};

export default async function AgentsPage() {
  const [agents, notes] = await Promise.all([getAgents(), getAgentNotes()]);

  return <AgentsView initialAgents={agents} initialNotes={notes} />;
}
