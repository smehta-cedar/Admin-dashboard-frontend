import "server-only";

/*
 * Data boundary for the agency: the one org record for this shop, read from
 * the Django API (`/api/v1/agencies/`, backend/apps/agency) as the signed-in
 * user. There is one agency on the frontend, so `getAgency()` is the first
 * (by the API's order) of the agencies list, or null when none exists yet
 * (run `python manage.py seed_agency`). Edits go through the server action
 * in app/(dashboard)/agency/actions.ts; the API records a change note on
 * every edit that changed something.
 *
 * The agency has the same producer shape as an agent (NPN, licensed states
 * with licence numbers, contact details) because it is licensed like one:
 * the API returns its licence rows (`licenses`) and licensedStates /
 * licenseNumbers / licenseStatuses / licenseDates are derived from them
 * here, the same way an agent's are (lib/agents.ts). It is the org
 * identity, licence footprint and roster only. Its carrier contracts live in
 * lib/agency-contracts.ts and its own portal logins are agency passwords
 * (lib/passwords.ts).
 *
 * The profile's Edit dialog changes the agency's own fields (AgencyValues);
 * the licence rows are added, edited and removed one at a time from the
 * profile's State licences panel, through the licence actions in
 * app/(dashboard)/agency/actions.ts.
 *
 * data/agency.json and data/agency-state-licenses.json are no longer read
 * here; they are the seed files for `seed_agency`.
 */

import type { AgencyStateLicenseRecord } from "@/lib/agency-state-licenses";
import { apiFetch, apiGet, ApiError } from "@/lib/api-server";
import type { FieldChange } from "@/lib/change-notes";
import { formatPhone } from "@/lib/phone";
import {
  STATE_LICENSE_STATUSES,
  licenseDatesOf,
  licenseNumbersOf,
  licenseStatusesOf,
  licensedStatesOf,
  type LicenceDates,
  type StateLicenseStatus,
} from "@/lib/state-licenses";

export type AgencyStatus = "active" | "inactive";

export type AgencyRecord = {
  /** The API's UUID. */
  id: string;
  /** Legal agency name. */
  name: string;
  /** DBA and other names. Empty when none. */
  aliases: string[];
  status: AgencyStatus;
  /** The agency's own National Producer Number. */
  npn: string;
  /**
   * US state codes from lib/us-states.ts the agency holds a licence in, unique
   * and in code order. Empty when licensed nowhere yet (not "all states").
   * Derived from the agency's licence rows, never stored.
   */
  licensedStates: string[];
  /** Licence number by state code, for states in licensedStates only. Derived from the rows too. */
  licenseNumbers: Record<string, string>;
  /** Licence status by state code, every state in licensedStates. Derived from the rows too. */
  licenseStatuses: Record<string, StateLicenseStatus>;
  /** Licence term by state code, every state in licensedStates. Derived from the rows too. */
  licenseDates: Record<string, LicenceDates>;
  email: string;
  /** "(555)010-4410" (formatPhone); other lengths stay as entered. */
  phone: string;
};

/** Agency fields a note can record. The ID never changes. */
export type AgencyField = Exclude<keyof AgencyRecord, "id">;

/** What the profile's edit form submits: the agency's own fields, not its licences. */
export type AgencyValues = Pick<AgencyRecord, "name" | "aliases" | "status" | "npn" | "email" | "phone">;

export type AgencyChange = FieldChange<AgencyField>;

/**
 * Change-log entry the API writes whenever the agency is edited.
 * Append-only.
 */
export type AgencyNote = {
  id: string;
  agencyId: AgencyRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Full name of who made the change, or null when unknown. */
  createdBy: string | null;
  /** Only the fields that changed, in form order. */
  changes: AgencyChange[];
};

/** A licence row as the API serialises it, nested on the agency. */
type ApiAgencyLicense = {
  id: string;
  state: string;
  license_number: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

/** An agency as the API serialises it (AgencySerializer). */
export type ApiAgency = {
  id: string;
  name: string;
  aliases: string[];
  npn: string;
  email: string;
  phone: string;
  licenses: ApiAgencyLicense[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** A note as the API serialises it (AgencyNoteSerializer). */
type ApiAgencyNote = {
  id: string;
  agency_id: string;
  kind: "added" | "edited";
  changes: { field: string; from: string; to: string }[];
  created_by: string | null;
  created_at: string;
};

/** API field name -> AgencyRecord field, for a note's changes. */
const NOTE_FIELDS: Record<string, AgencyField> = {
  name: "name",
  aliases: "aliases",
  status: "status",
  npn: "npn",
  email: "email",
  phone: "phone",
  licensed_states: "licensedStates",
  license_numbers: "licenseNumbers",
  license_statuses: "licenseStatuses",
  license_dates: "licenseDates",
};

/** The API agency's licence rows as the app holds them. An unknown status reads as "active" with a console warning. */
export function toAgencyLicenseRecords(agency: ApiAgency): AgencyStateLicenseRecord[] {
  return agency.licenses.map((row) => {
    const knownStatus = STATE_LICENSE_STATUSES.includes(row.status);
    if (!knownStatus) {
      console.warn(`Agency licence ${row.id} has status ${JSON.stringify(row.status)}; treating it as "active".`);
    }
    return {
      id: row.id,
      state: row.state,
      licenseNumber: row.license_number,
      status: knownStatus ? (row.status as StateLicenseStatus) : "active",
      startDate: row.start_date ?? "",
      endDate: row.end_date ?? "",
      // The agency API records no lines of business; only agent licences have them.
      life: false,
      health: false,
    };
  });
}

/** An API agency as the app holds it: phone formatted, the licence fields derived from the rows. */
export function toAgencyRecord(agency: ApiAgency): AgencyRecord {
  const licenses = toAgencyLicenseRecords(agency);
  return {
    id: agency.id,
    name: agency.name,
    aliases: agency.aliases,
    status: agency.is_active ? "active" : "inactive",
    npn: agency.npn,
    licensedStates: licensedStatesOf(licenses),
    licenseNumbers: licenseNumbersOf(licenses),
    licenseStatuses: licenseStatusesOf(licenses),
    licenseDates: licenseDatesOf(licenses),
    email: agency.email,
    phone: formatPhone(agency.phone),
  };
}

function toAgencyNote(note: ApiAgencyNote): AgencyNote {
  return {
    id: note.id,
    agencyId: note.agency_id,
    kind: note.kind,
    createdAt: note.created_at,
    createdBy: note.created_by,
    changes: note.changes.flatMap((change) => {
      const field = NOTE_FIELDS[change.field];
      return field ? [{ field, from: change.from, to: change.to }] : [];
    }),
  };
}

/** The agency with its licence rows, or null when none exists yet. One API read. */
export async function getAgencyWithLicenses(): Promise<{
  agency: AgencyRecord;
  licenses: AgencyStateLicenseRecord[];
} | null> {
  const result = await apiFetch<ApiAgency[]>("/agencies/", { params: { page_size: 1 } });
  if (!result.ok) throw new ApiError("/agencies/", result);
  const first = result.data[0];
  if (!first) return null;
  return { agency: toAgencyRecord(first), licenses: toAgencyLicenseRecords(first) };
}

/** The agency, or null when none exists yet. */
export async function getAgency(): Promise<AgencyRecord | null> {
  return (await getAgencyWithLicenses())?.agency ?? null;
}

/** The agency's change notes, newest first. */
export async function getAgencyNotes(agencyId: string): Promise<AgencyNote[]> {
  const notes = await apiGet<ApiAgencyNote[]>(`/agencies/${encodeURIComponent(agencyId)}/notes/`);
  return notes.map(toAgencyNote);
}
