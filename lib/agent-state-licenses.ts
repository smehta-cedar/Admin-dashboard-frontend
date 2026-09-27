import "server-only";

/*
 * Data boundary for agent state licences. The rows come with each agent
 * from the Django API (lib/agents.ts reads `/api/v1/agents/`, whose agents
 * carry their `licenses`); this module is the view of them as a flat list,
 * for pages that read licences across agents (HR's calendar).
 *
 * One row is one agent's licence in one state (lib/state-licenses.ts has the
 * shape and the rules). These rows are where an agent's licensedStates and
 * licenseNumbers come from: lib/agents.ts derives both from them when an
 * agent loads, and the agent form's save edits them through the API. The
 * agency's own licences live in lib/agency-state-licenses.ts.
 */

import { getAgentsWithLicenses, type AgentRecord } from "@/lib/agents";
import type { StateLicense, StateLicenseStatus } from "@/lib/state-licenses";

export type AgentStateLicenseStatus = StateLicenseStatus;

export type AgentStateLicenseRecord = StateLicense & {
  agentId: AgentRecord["id"];
};

/** Every agent's licence rows, agents by name and each agent's rows in state-code order. */
export async function getAgentStateLicenses(): Promise<AgentStateLicenseRecord[]> {
  return (await getAgentsWithLicenses()).licenses;
}
