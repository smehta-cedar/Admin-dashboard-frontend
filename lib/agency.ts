import "server-only";

/*
 * Data boundary for the agency: the one org record for this shop. Today it
 * reads data/agency.json (a single object, not an array) and
 * data/agency-notes.json; later it queries Supabase. The JSON is trusted
 * as-is, except that the phone loads in the one display format (lib/phone.ts)
 * and licensedStates / licenseNumbers are derived from the agency's state
 * licence rows (lib/agency-state-licenses.ts), the same way an agent's are.
 *
 * The agency has the same producer shape as an agent (NPN, licensed states
 * with licence numbers, contact details) because it is licensed like one. It
 * is the org identity, licence footprint and roster only: it is not a
 * participant in carrier contracts or passwords, which stay on individual agents.
 * There is one agency, so no ID and no list.
 */

import agencyJson from "@/data/agency.json";
import notesJson from "@/data/agency-notes.json";
import { getAgencyStateLicenses } from "@/lib/agency-state-licenses";
import { formatPhone } from "@/lib/phone";
import { licenseNumbersOf, licensedStatesOf } from "@/lib/state-licenses";

export type AgencyStatus = "active" | "inactive";

export type AgencyRecord = {
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
   * Derived from the agency's state licence rows, never stored.
   */
  licensedStates: string[];
  /** Licence number by state code, for states in licensedStates only. Derived from the rows too. */
  licenseNumbers: Record<string, string>;
  email: string;
  /** "(555)010-4410" (formatPhone); other lengths stay as entered. */
  phone: string;
};

/** Agency fields a note can record. There is no ID. */
export type AgencyField = keyof AgencyRecord;

export type AgencyChange = {
  field: AgencyField;
  /** Value before, as shown in the UI (lists joined with ", "). Empty for the first record. */
  from: string;
  to: string;
};

/**
 * Change-log entry, written automatically whenever the agency is edited.
 * Append-only. No agencyId: there is only one agency.
 */
export type AgencyNote = {
  id: string;
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Only the fields that changed, in form order. */
  changes: AgencyChange[];
};

/** The agency as the JSON holds it: without the two fields derived from licence rows. */
type StoredAgency = Omit<AgencyRecord, "licensedStates" | "licenseNumbers">;

/**
 * The agency, with the phone in the display format and licensedStates /
 * licenseNumbers derived from its licence rows.
 */
export async function getAgency(): Promise<AgencyRecord> {
  const agency = agencyJson as StoredAgency;
  const licenses = await getAgencyStateLicenses();
  return {
    ...agency,
    phone: formatPhone(agency.phone),
    licensedStates: licensedStatesOf(licenses),
    licenseNumbers: licenseNumbersOf(licenses),
  };
}

/** Every agency note, newest first. */
export async function getAgencyNotes(): Promise<AgencyNote[]> {
  return (notesJson as AgencyNote[])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
