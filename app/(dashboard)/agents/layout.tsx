import type { ReactNode } from "react";
import { getAgentStateLicenses } from "@/lib/agent-state-licenses";
import { getAgentNotes, getAgents } from "@/lib/agents";
import { AgentsProvider } from "./agents-store";

/*
 * Loads the agents, their notes and licence rows once for the whole section
 * and hands them to the client store (./agents-store.tsx), so /agents and
 * /agents/new share one dummy state across navigations. The layout is what
 * keeps that state alive between the two pages; a refresh starts it over.
 */
export default async function AgentsLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [agents, notes, licenses] = await Promise.all([
    getAgents(),
    getAgentNotes(),
    getAgentStateLicenses(),
  ]);

  return (
    <AgentsProvider initialAgents={agents} initialNotes={notes} initialLicenses={licenses}>
      {children}
    </AgentsProvider>
  );
}
