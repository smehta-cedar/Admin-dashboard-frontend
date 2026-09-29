import "server-only";

/*
 * Data boundary for agents: reads the Django API (backend/apps/agents,
 * `/api/v1/agents/`) as the signed-in user. Adds and edits go through the
 * server actions in app/(dashboard)/agents/actions.ts, which post to the
 * same API; the API records a change note on every add and every edit that
 * changed something. Phones load in the one display format (lib/phone.ts).
 *
 * licensedStates is the agent's own resident/non-resident licences: where they
 * may write at all, whoever the carrier. It is one of the two ceilings on an
 * appointment — the other is the carrier's availableStates (lib/carriers.ts).
 * An agent can write with a carrier in a state only when the state is in both,
 * and an appointment lists it. Empty means licensed nowhere, never "everywhere".
 *
 * licenseNumbers holds the licence number the state issued, per licensed state;
 * licenseLines and licenseDates the lines and the term of each.
 *
 * None is stored on the agent. All are derived here from the agent's
 * licence rows, which the API returns with each agent (one row per state with
 * its number, status and dates): every row lists its state, and a row whose
 * number is still blank (a pending licence) shows "No number yet". The agent
 * form edits those rows through the API (`licenses` on save), which derives
 * the two fields the same way.
 *
 * Email and phone are the agent's work contact. personalEmail, personalPhone
 * and address are their own contact details, all optional and agent-only (the
 * agency, which shares the producer form, has none of them). dateOfBirth,
 * joinDate (joined the agency) and startDate (employment start, not a
 * licence's) are "YYYY-MM-DD"; ssnLast4 is only ever the last four digits of
 * the SSN, shown masked, and notes record that it changed but never the digits.
 *
 * Writing numbers are not stored on agents or carriers. They live on carrier
 * contracts in lib/carrier-contracts.ts (one agent's producer ID at one
 * carrier). Portal username and password live with Passwords in
 * lib/passwords.ts.
 *
 * The commission matrix still uses the slim `Agent` ({ id, name }) from
 * commissions.ts. Don't widen that; use AgentRecord here for agent detail.
 *
 * data/agents.json and data/agent-state-licenses.json are no longer read
 * here; they are the seed files for `python manage.py seed_agents`.
 */

import type { Address } from "@/lib/address";
import type { AgentStateLicenseRecord } from "@/lib/agent-state-licenses";
import { apiFetch, apiGet, apiGetAll, ApiError } from "@/lib/api-server";
import type { FieldChange } from "@/lib/change-notes";
import { formatPhone } from "@/lib/phone";
import {
  STATE_LICENSE_STATUSES,
  licenseDatesOf,
  licenseLinesOf,
  licenseNumbersOf,
  licensedStatesOf,
  type LicenceDates,
  type LicenceLines,
  type StateLicenseStatus,
} from "@/lib/state-licenses";

export type AgentStatus = "active" | "inactive";

export type AgentRecord = {
  /** The API's UUID. Not the NPN or a writing number. */
  id: string;
  /** Legal / full name. */
  name: string;
  /** Other names seen on statements (DBA, nickname, maiden). Empty when none. */
  aliases: string[];
  /** The API's is_active. Defaults to "active" when adding. */
  status: AgentStatus;
  /**
   * US state codes from lib/us-states.ts the agent holds a licence in, unique
   * and in code order. Empty when licensed nowhere yet (not "all states").
   * Derived from the agent's licence rows, never stored.
   */
  licensedStates: string[];
  /**
   * Licence number by state code, for states in licensedStates only. Derived
   * from the rows too; a state whose licence has no number yet is left out.
   */
  licenseNumbers: Record<string, string>;
  /**
   * The Life / Health lines each licence covers, by state code, for every
   * state in licensedStates. Derived from the rows too.
   */
  licenseLines: Record<string, LicenceLines>;
  /**
   * When each licence starts and ends, by state code, for every state in
   * licensedStates. Derived from the rows too; the form enters them.
   */
  licenseDates: Record<string, LicenceDates>;
  /** National Producer Number. Unique across agents. */
  npn: string;
  /** Work email. */
  email: string;
  /** Work phone, "(555)010-4410" (formatPhone); other lengths stay as entered. */
  phone: string;
  personalEmail?: string;
  /** Same format as `phone`. */
  personalPhone?: string;
  /** Home address: street, city, state code and ZIP. */
  address?: Address;
  /** "YYYY-MM-DD". */
  dateOfBirth?: string;
  /** When they joined the agency, "YYYY-MM-DD". */
  joinDate?: string;
  /** Employment start, "YYYY-MM-DD". Not a licence's start date. */
  startDate?: string;
  /** The last four digits of the SSN, never the full number. */
  ssnLast4?: string;
};

/** Agent fields a note can record. The ID never changes. */
export type AgentField = Exclude<keyof AgentRecord, "id">;

/** What the add / edit form submits: every field but the ID. */
export type AgentValues = Omit<AgentRecord, "id">;

export type AgentChange = FieldChange<AgentField>;

/**
 * Change-log entry the API writes whenever an agent is added or edited.
 * Append-only: notes are never edited or deleted.
 */
export type AgentNote = {
  id: string;
  agentId: AgentRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Full name of who made the change, or null when unknown. */
  createdBy: string | null;
  /** Only the fields that changed, in form order. */
  changes: AgentChange[];
};

/** A licence row as the API serialises it, nested on an agent. */
export type ApiAgentLicense = {
  id: string;
  state: string;
  license_number: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  life: boolean;
  health: boolean;
};

/** An agent as the API serialises it (AgentSerializer). */
export type ApiAgent = {
  id: string;
  name: string;
  aliases: string[];
  npn: string;
  email: string;
  phone: string;
  personal_email: string;
  personal_phone: string;
  address: Address | null;
  date_of_birth: string | null;
  join_date: string | null;
  start_date: string | null;
  ssn_last4: string;
  licenses: ApiAgentLicense[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** A note as the API serialises it (AgentNoteSerializer). */
type ApiAgentNote = {
  id: string;
  agent_id: string;
  kind: "added" | "edited";
  changes: { field: string; from: string; to: string }[];
  created_by: string | null;
  created_at: string;
};

/** API field name -> AgentRecord field, for a note's changes. */
const NOTE_FIELDS: Record<string, AgentField> = {
  name: "name",
  aliases: "aliases",
  status: "status",
  npn: "npn",
  email: "email",
  phone: "phone",
  personal_email: "personalEmail",
  personal_phone: "personalPhone",
  address: "address",
  date_of_birth: "dateOfBirth",
  join_date: "joinDate",
  start_date: "startDate",
  ssn_last4: "ssnLast4",
  licensed_states: "licensedStates",
  license_numbers: "licenseNumbers",
  license_lines: "licenseLines",
  license_dates: "licenseDates",
};

/** An API agent's licence rows as the app holds them. An unknown status reads as "active" with a console warning. */
export function toLicenseRecords(agent: ApiAgent): AgentStateLicenseRecord[] {
  return agent.licenses.map((row) => {
    const knownStatus = STATE_LICENSE_STATUSES.includes(row.status);
    if (!knownStatus) {
      console.warn(`State licence ${row.id} has status ${JSON.stringify(row.status)}; treating it as "active".`);
    }
    return {
      id: row.id,
      agentId: agent.id,
      state: row.state,
      licenseNumber: row.license_number,
      status: knownStatus ? (row.status as StateLicenseStatus) : "active",
      startDate: row.start_date ?? "",
      endDate: row.end_date ?? "",
      life: Boolean(row.life),
      health: Boolean(row.health),
    };
  });
}

/** An API agent as the app holds it: phones formatted, the licence fields derived from the rows. */
export function toAgentRecord(agent: ApiAgent): AgentRecord {
  const licenses = toLicenseRecords(agent);
  return {
    id: agent.id,
    name: agent.name,
    aliases: agent.aliases,
    status: agent.is_active ? "active" : "inactive",
    licensedStates: licensedStatesOf(licenses),
    licenseNumbers: licenseNumbersOf(licenses),
    licenseLines: licenseLinesOf(licenses),
    licenseDates: licenseDatesOf(licenses),
    npn: agent.npn,
    email: agent.email,
    phone: formatPhone(agent.phone),
    ...(agent.personal_email ? { personalEmail: agent.personal_email } : {}),
    ...(agent.personal_phone ? { personalPhone: formatPhone(agent.personal_phone) } : {}),
    ...(agent.address ? { address: agent.address } : {}),
    ...(agent.date_of_birth ? { dateOfBirth: agent.date_of_birth } : {}),
    ...(agent.join_date ? { joinDate: agent.join_date } : {}),
    ...(agent.start_date ? { startDate: agent.start_date } : {}),
    ...(agent.ssn_last4 ? { ssnLast4: agent.ssn_last4 } : {}),
  };
}

function toAgentNote(note: ApiAgentNote): AgentNote {
  return {
    id: note.id,
    agentId: note.agent_id,
    kind: note.kind,
    createdAt: note.created_at,
    createdBy: note.created_by,
    changes: note.changes.flatMap((change) => {
      const field = NOTE_FIELDS[change.field];
      return field ? [{ field, from: change.from, to: change.to }] : [];
    }),
  };
}

/** Every agent, active and inactive, sorted by name, with every licence row. One API read. */
export async function getAgentsWithLicenses(): Promise<{
  agents: AgentRecord[];
  licenses: AgentStateLicenseRecord[];
}> {
  const agents = await apiGetAll<ApiAgent>("/agents/");
  return {
    agents: agents.map(toAgentRecord),
    licenses: agents.flatMap(toLicenseRecords),
  };
}

/** Every agent, active and inactive, sorted by name. */
export async function getAgents(): Promise<AgentRecord[]> {
  return (await getAgentsWithLicenses()).agents;
}

/** One agent by ID with their licence rows, or null when there is none (or the ID isn't one). */
export async function getAgentWithLicenses(
  id: string,
): Promise<{ agent: AgentRecord; licenses: AgentStateLicenseRecord[] } | null> {
  const result = await apiFetch<ApiAgent>(`/agents/${encodeURIComponent(id)}/`);
  if (!result.ok) {
    if (result.status === 404) return null;
    throw new ApiError(`/agents/${id}/`, result);
  }
  return { agent: toAgentRecord(result.data), licenses: toLicenseRecords(result.data) };
}

/** One agent by ID, or null when there is none. */
export async function getAgent(id: string): Promise<AgentRecord | null> {
  return (await getAgentWithLicenses(id))?.agent ?? null;
}

/** One agent's change notes, newest first. */
export async function getAgentNotes(agentId: string): Promise<AgentNote[]> {
  const notes = await apiGet<ApiAgentNote[]>(`/agents/${encodeURIComponent(agentId)}/notes/`);
  return notes.map(toAgentNote);
}
