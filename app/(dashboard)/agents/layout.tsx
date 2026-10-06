import type { ReactNode } from "react";
import { canViewModule } from "@/lib/access";
import { getAgentsWithLicenses } from "@/lib/agents";
import { AgentsProvider } from "./agents-store";

/*
 * Loads the agents and their licence rows once from the API for the whole
 * section and hands them to the client store (./agents-store.tsx), so
 * /agents and /agents/new share one state across navigations. Saves go to
 * the API and revalidate this layout, so a refresh shows the same thing.
 *
 * A role without agents view skips the load (the API would answer 403);
 * each page then shows "No access" on its own (lib/access.ts).
 */
export default async function AgentsLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!(await canViewModule("agents"))) return children;
  const { agents, licenses } = await getAgentsWithLicenses();

  return (
    <AgentsProvider initialAgents={agents} initialLicenses={licenses}>
      {children}
    </AgentsProvider>
  );
}
