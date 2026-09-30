import "server-only";

/*
 * The signed-in agent's own profile: GET /auth/agent/. Staff accounts are
 * not linked to an agent, so this is null for them. The code they sign in
 * with is not in the payload.
 *
 * Shaped for the same AgentProfile staff see, opened read-only: contracts
 * as CarrierContractRecord, and one carrier option per contract.
 *
 * Each section is granted by the role named "Agent" (Agent view / My ...).
 * `sections` says which; one the role doesn't grant comes back null, and
 * without "My details" the agent holds only their name and status.
 */

import type { AgentStateLicenseRecord } from "@/lib/agent-state-licenses";
import { toAgentRecord, toLicenseRecords, type AgentRecord, type ApiAgent } from "@/lib/agents";
import { apiFetch } from "@/lib/api-server";
import { toContractRecord, type ApiContract, type CarrierContractRecord } from "@/lib/carrier-contracts";
import { toPasswordRecord, type ApiPassword, type PasswordRecord } from "@/lib/passwords";
import type { CarrierRecord } from "@/lib/carriers";
import { toCertificationRecord, type ApiCertification, type CertificationRecord } from "@/lib/certifications";

export type AgentHomeCarrier = Pick<CarrierRecord, "id" | "name" | "status" | "availableStates" | "agentAccessible">;

/** The Agent view sections the role grants. */
export type AgentHomeSections = {
  profile: boolean;
  licenses: boolean;
  contracts: boolean;
  certifications: boolean;
  passwords: boolean;
};

export type AgentHome = {
  sections: AgentHomeSections;
  agent: AgentRecord;
  licenses: AgentStateLicenseRecord[];
  /** Null when "My carriers" isn't granted, like the lists below. */
  contracts: CarrierContractRecord[] | null;
  carriers: AgentHomeCarrier[];
  certifications: CertificationRecord[] | null;
  passwords: PasswordRecord[] | null;
};

type ApiAgentHome = {
  sections: AgentHomeSections;
  agent: ApiAgent;
  contracts: ApiContract[] | null;
  certifications: ApiCertification[] | null;
  passwords: ApiPassword[] | null;
};

/** The signed-in agent's profile, or null when the API refuses it. */
export async function getAgentHome(): Promise<AgentHome | null> {
  const result = await apiFetch<ApiAgentHome>("/auth/agent/");
  if (!result.ok) return null;
  const { sections, agent, contracts, certifications, passwords } = result.data;
  return {
    sections,
    agent: toAgentRecord(agent),
    licenses: toLicenseRecords(agent),
    contracts: contracts?.map(toContractRecord) ?? null,
    // The payload has no carrier footprint. Appointed states always sit inside
    // it, so they stand in for it and the profile's writable states come out the same.
    carriers: (contracts ?? [])
      .map((contract) => ({
        id: contract.carrier.id,
        name: contract.carrier.name,
        status: contract.carrier.is_active ? ("active" as const) : ("inactive" as const),
        availableStates: [...contract.appointed_states],
        agentAccessible: false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    certifications: certifications?.map(toCertificationRecord) ?? null,
    passwords: passwords?.map(toPasswordRecord) ?? null,
  };
}
