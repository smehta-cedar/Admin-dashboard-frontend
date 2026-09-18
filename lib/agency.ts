import "server-only";

/*
 * Data boundary for the agency: the one org record for this shop. Today it
 * reads data/agency.json (a single object, not an array) and
 * data/agency-notes.json; later it queries Supabase. The JSON is trusted
 * as-is, except that states and licence numbers load the same way agents' do
 * and the phone loads in the one display format (lib/phone.ts).
 *
 * The agency has the same producer shape as an agent (NPN, licensed states
 * with licence numbers, contact details) because it is licensed like one. It
 * is the org identity, licence footprint and roster only: it is not a
 * participant in carrier contracts or logins, which stay on individual agents.
 * There is one agency, so no ID and no list.
 */

import agencyJson from "@/data/agency.json";
import notesJson from "@/data/agency-notes.json";
import { formatPhone } from "@/lib/phone";

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
   */
  licensedStates: string[];
  /** Licence number by state code, for states in licensedStates only. Required per licensed state when saving. */
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

/** The agency as the JSON may hold it: states or numbers may be missing. */
type StoredAgency = Omit<AgencyRecord, "licensedStates" | "licenseNumbers"> & {
  licensedStates?: string[];
  licenseNumbers?: Partial<Record<string, string>>;
};

/**
 * The agency, with licensedStates unique and in code order, only non-blank
 * licence numbers for licensed states, and the phone in the display format.
 */
export async function getAgency(): Promise<AgencyRecord> {
  const agency = agencyJson as StoredAgency;
  if (!Array.isArray(agency.licensedStates)) {
    console.warn("The agency has no licensedStates; treating it as licensed in no states.");
  }
  const states = [...new Set(Array.isArray(agency.licensedStates) ? agency.licensedStates : [])].sort();
  const numbers = agency.licenseNumbers ?? {};
  return {
    ...agency,
    phone: formatPhone(agency.phone),
    licensedStates: states,
    licenseNumbers: Object.fromEntries(
      states.flatMap((code) => {
        const number = (numbers[code] ?? "").trim();
        return number ? [[code, number]] : [];
      }),
    ),
  };
}

/** Every agency note, newest first. */
export async function getAgencyNotes(): Promise<AgencyNote[]> {
  return (notesJson as AgencyNote[])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
