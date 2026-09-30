import "server-only";

/*
 * The signed-in agent's own profile: GET /auth/agent/. Staff accounts are
 * not linked to an agent, so this is null for them. The code they sign in
 * with is not in the payload.
 *
 * Shaped for the same AgentProfile staff see, opened read-only: contracts
 * as CarrierContractRecord, and one carrier option per contract.
 */

import type { AgentStateLicenseRecord } from "@/lib/agent-state-licenses";
import { toAgentRecord, toLicenseRecords, type AgentRecord, type ApiAgent } from "@/lib/agents";
import { apiFetch } from "@/lib/api-server";
import { toContractRecord, type ApiContract, type CarrierContractRecord } from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import { toCertificationRecord, type ApiCertification, type CertificationRecord } from "@/lib/certifications";

export type AgentHomeCarrier = Pick<CarrierRecord, "id" | "name" | "status" | "availableStates" | "agentAccessible">;

export type AgentHome = {
  agent: AgentRecord;
  licenses: AgentStateLicenseRecord[];
  contracts: CarrierContractRecord[];
  carriers: AgentHomeCarrier[];
  certifications: CertificationRecord[];
};

type ApiAgentHome = {
  agent: ApiAgent;
  contracts: ApiContract[];
  certifications: ApiCertification[];
};

/** The signed-in agent's profile, or null when the API refuses it. */
export async function getAgentHome(): Promise<AgentHome | null> {
  const result = await apiFetch<ApiAgentHome>("/auth/agent/");
  if (!result.ok) return null;
  const { agent, contracts, certifications } = result.data;
  return {
    agent: toAgentRecord(agent),
    licenses: toLicenseRecords(agent),
    contracts: contracts.map(toContractRecord),
    // The payload has no carrier footprint. Appointed states always sit inside
    // it, so they stand in for it and the profile's writable states come out the same.
    carriers: contracts
      .map((contract) => ({
        id: contract.carrier.id,
        name: contract.carrier.name,
        status: contract.carrier.is_active ? ("active" as const) : ("inactive" as const),
        availableStates: [...contract.appointed_states],
        agentAccessible: false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    certifications: certifications.map(toCertificationRecord),
  };
}
