import "server-only";

/*
 * Data boundary for agent state licences. Today it reads
 * data/agent-state-licenses.json; later it queries Supabase. The JSON is
 * trusted as-is, not validated, except that a missing or unknown status
 * reads as "active" (with a console warning naming the row).
 *
 * One row is one agent's licence in one state (lib/state-licenses.ts has the
 * shape and the rules). These rows are where an agent's licensedStates and
 * licenseNumbers come from: lib/agents.ts derives both from them when an
 * agent loads, and the agent dialog's save edits these rows. The agency's
 * own licences live in lib/agency-state-licenses.ts.
 */

import licensesJson from "@/data/agent-state-licenses.json";
import type { AgentRecord } from "@/lib/agents";
import {
  STATE_LICENSE_STATUSES,
  type StateLicense,
  type StateLicenseStatus,
} from "@/lib/state-licenses";

export type AgentStateLicenseStatus = StateLicenseStatus;

export type AgentStateLicenseRecord = StateLicense & {
  agentId: AgentRecord["id"];
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
      const knownStatus =
        license.status !== undefined && STATE_LICENSE_STATUSES.includes(license.status);
      if (!knownStatus) {
        console.warn(
          `State licence ${license.id} has status ${JSON.stringify(license.status)}; treating it as "active".`,
        );
      }
      return {
        ...license,
        status: knownStatus ? (license.status as StateLicenseStatus) : "active",
      };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}
