import "server-only";

/*
 * Data boundary for the agency's state licences. The rows come with the
 * agency from the Django API (lib/agency.ts reads `/api/v1/agencies/`, whose
 * agency carries its `licenses`); this module is the view of them as a flat
 * list. Mirrors lib/agent-state-licenses.ts, one row per state, except that
 * a row has no owner ID: the agency is a singleton, so every row here
 * belongs to it. These rows are where the agency's licensedStates and
 * licenseNumbers come from, and the agency form's save edits them through
 * the API.
 */

import { getAgencyWithLicenses } from "@/lib/agency";
import type { StateLicense, StateLicenseStatus } from "@/lib/state-licenses";

export type AgencyStateLicenseStatus = StateLicenseStatus;

export type AgencyStateLicenseRecord = StateLicense;

/** The agency's licence rows, in state-code order; none when there is no agency yet. */
export async function getAgencyStateLicenses(): Promise<AgencyStateLicenseRecord[]> {
  return (await getAgencyWithLicenses())?.licenses ?? [];
}
