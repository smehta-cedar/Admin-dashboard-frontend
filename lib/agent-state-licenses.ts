import "server-only";

/*
 * Data boundary for agent state licences. Today it reads
 * data/agent-state-licenses.json; later it queries Supabase. The JSON is
 * trusted as-is, not validated, except that a missing or unknown status
 * reads as "active" (with a console warning naming the row).
 *
 * One row is one agent's licence in one state: the number the state issued,
 * where it stands, and the dates it runs between. This is the same fact
 * AgentRecord.licensedStates / licenseNumbers hold today; those stay in place
 * for now because Contracts still reads them as the licence ceiling. Only the
 * agent profile reads this file so far. The agency's own licences are not here.
 */

import licensesJson from "@/data/agent-state-licenses.json";
import type { AgentRecord } from "@/lib/agents";

/**
 * active: licence in force. review: renewal or paperwork under review.
 * pending: applied for, not issued yet. jit: "just in time" — obtained only
 * when a sale there needs it.
 */
export type AgentStateLicenseStatus = "active" | "review" | "pending" | "jit";

const LICENSE_STATUSES: readonly string[] = [
  "active",
  "review",
  "pending",
  "jit",
] satisfies AgentStateLicenseStatus[];

export type AgentStateLicenseRecord = {
  /** Internal ID, numbered 1, 2, 3, … for now. Not the licence number. */
  id: string;
  agentId: AgentRecord["id"];
  /** US state code from lib/us-states.ts. One row per agent + state. */
  state: string;
  /** The number the state issued. Empty while the licence is still pending. */
  licenseNumber: string;
  status: AgentStateLicenseStatus;
  /** YYYY-MM-DD. When the licence was added. */
  startDate: string;
  /** YYYY-MM-DD. When it expires. */
  endDate: string;
};

/** A licence as the JSON may hold it: a status we don't know, or none. */
type StoredLicense = Omit<AgentStateLicenseRecord, "status"> & { status?: string };

/**
 * Every state licence, whatever its status, in ID order (1, 2, 3, …). A
 * missing or unknown status reads as "active" (with a console warning naming
 * the licence), so the page still renders it.
 */
export async function getAgentStateLicenses(): Promise<AgentStateLicenseRecord[]> {
  return (licensesJson as StoredLicense[])
    .map((license) => {
      const knownStatus = license.status !== undefined && LICENSE_STATUSES.includes(license.status);
      if (!knownStatus) {
        console.warn(
          `State licence ${license.id} has status ${JSON.stringify(license.status)}; treating it as "active".`,
        );
      }
      return {
        ...license,
        status: knownStatus ? (license.status as AgentStateLicenseStatus) : "active",
      };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}
