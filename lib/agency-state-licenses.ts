import "server-only";

/*
 * Data boundary for the agency's state licences. Today it reads
 * data/agency-state-licenses.json; later it queries Supabase. The JSON is
 * trusted as-is, not validated, except that a missing or unknown status
 * reads as "active" (with a console warning naming the row).
 *
 * Mirrors lib/agent-state-licenses.ts, one row per state, except that a row
 * has no owner ID: the agency is a singleton (data/agency.json is one object,
 * AgencyRecord has no id), so every row here belongs to it. These rows are
 * where the agency's licensedStates and licenseNumbers come from:
 * lib/agency.ts derives both when the agency loads, and the agency dialog's
 * save edits these rows.
 */

import licensesJson from "@/data/agency-state-licenses.json";
import {
  STATE_LICENSE_STATUSES,
  type StateLicense,
  type StateLicenseStatus,
} from "@/lib/state-licenses";

export type AgencyStateLicenseStatus = StateLicenseStatus;

export type AgencyStateLicenseRecord = StateLicense;

/** A licence as the JSON may hold it: a status we don't know, or none. */
type StoredLicense = Omit<AgencyStateLicenseRecord, "status"> & { status?: string };

/**
 * Every agency state licence, whatever its status, in ID order (1, 2, 3, …).
 * A missing or unknown status reads as "active" (with a console warning
 * naming the licence), so the page still renders it.
 */
export async function getAgencyStateLicenses(): Promise<AgencyStateLicenseRecord[]> {
  return (licensesJson as StoredLicense[])
    .map((license) => {
      const knownStatus =
        license.status !== undefined && STATE_LICENSE_STATUSES.includes(license.status);
      if (!knownStatus) {
        console.warn(
          `Agency state licence ${license.id} has status ${JSON.stringify(license.status)}; treating it as "active".`,
        );
      }
      return {
        ...license,
        status: knownStatus ? (license.status as StateLicenseStatus) : "active",
      };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}
