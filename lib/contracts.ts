import "server-only";

/*
 * Data boundary for contracts. Today it reads fake records from
 * data/contracts.json; later it queries Supabase. The JSON is trusted as-is,
 * not validated.
 *
 * Phase 1 holds state licenses only: one record per agent listing the states
 * that agent is licensed in. Licenses live here, not on AgentRecord, so a later
 * phase can add carrierId (contracts per carrier) without reshaping Agents.
 */

import contractsJson from "@/data/contracts.json";

export type ContractStatus = "active" | "inactive";

export type ContractRecord = {
  /** Internal ID, numbered 1, 2, 3, … for now. */
  id: string;
  /** The agent this record belongs to. One record per agent. */
  agentId: string;
  /** US state codes from lib/us-states.ts ("TX", "CA", …). Empty when none. */
  licensedStates: string[];
  /** Defaults to "active". Only active records count on the map. */
  status: ContractStatus;
};

/** Every contract, active and inactive, in ID order (1, 2, 3, …). */
export async function getContracts(): Promise<ContractRecord[]> {
  return (contractsJson as ContractRecord[]).slice().sort((a, b) => Number(a.id) - Number(b.id));
}
