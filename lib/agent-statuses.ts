/*
 * Where an agent stands with the agency. Plain constants, safe to import
 * from client components (lib/agents.ts is server-only). Every status but
 * "inactive" counts as active: the API's is_active is false for it alone.
 */

/** Form order; the API's AGENT_STATUSES. */
export const AGENT_STATUSES = ["active", "onboarding", "sdr", "inactive"] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];

/**
 * The API's status as the app holds it. A status the app doesn't know falls
 * back to is_active ("active" / "inactive") with a console warning.
 */
export function toAgentStatus(status: string | undefined, isActive: boolean, name: string): AgentStatus {
  if ((AGENT_STATUSES as readonly string[]).includes(status ?? "")) return status as AgentStatus;
  console.warn(`Agent ${name} has status ${JSON.stringify(status)}; reading it from is_active.`);
  return isActive ? "active" : "inactive";
}
