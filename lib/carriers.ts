import "server-only";

/*
 * Data boundary for carriers: reads the Django API (backend/apps/carriers,
 * `/api/v1/carriers/`) as the signed-in user. Adds and edits go through the
 * server actions in app/(dashboard)/carriers/actions.ts, which post to the
 * same API; the API records a change note on every add and every edit that
 * changed something.
 *
 * A carrier is listed once however many lines of business it writes (e.g.
 * HealthSpring is both MAPD and Supp/Ancillary). Writing numbers are not
 * stored on carriers; they live on carrier contracts in
 * lib/carrier-contracts.ts. Portal username and password live with
 * Passwords in lib/passwords.ts.
 *
 * availableStates is the carrier's footprint for the agency: one of the two
 * ceilings on every appointment with it (lib/carrier-contracts.ts), the other
 * being the agent's own licensedStates (lib/agents.ts). An agent's
 * appointedStates with a carrier must be within both. Empty means available in
 * no states yet, never "every state".
 *
 * The commission matrix still uses the slim `Carrier` ({ code, name }) and its
 * own getCarriers() from commissions.ts. Don't widen that; use CarrierRecord
 * here for carrier detail.
 *
 * data/carriers.json is no longer read here; it is the seed file for
 * `python manage.py seed_carriers`.
 */

import { apiFetch, apiGet, apiGetAll, ApiError } from "@/lib/api-server";
import type { FieldChange } from "@/lib/change-notes";
import { LINES_OF_BUSINESS, type LineOfBusiness } from "@/lib/lines-of-business";

export type { LineOfBusiness } from "@/lib/lines-of-business";

export type CarrierStatus = "active" | "inactive";

export type CarrierRecord = {
  /** The API's UUID. Not a carrier code. */
  id: string;
  /** Name as the team refers to the carrier. Unique across carrier names and aliases. */
  name: string;
  /** Other names seen on statements or in conversation. Empty when none. */
  aliases: string[];
  /** At least one, in LINES_OF_BUSINESS order. */
  linesOfBusiness: LineOfBusiness[];
  /**
   * US state codes from lib/us-states.ts the carrier is available in for the
   * agency, unique and in code order. Empty when none yet (not "all states").
   */
  availableStates: string[];
  /** The API's is_active. Defaults to "active" when adding. */
  status: CarrierStatus;
  /**
   * The API's agent_accessible: true only when the agency's live contract with
   * the carrier has a contract number (lib/agency-contracts.ts). The dropdowns
   * that give an agent a carrier (appointments, portal passwords) offer only
   * these. Derived by the API, never edited on the carrier.
   */
  agentAccessible: boolean;
};

/** Carrier fields a note can record. The ID never changes. */
export type CarrierField = Exclude<keyof CarrierRecord, "id" | "agentAccessible">;

/** What the add / edit form submits: every field but the ID and the derived flag. */
export type CarrierValues = Omit<CarrierRecord, "id" | "agentAccessible">;

/** A save error, shown under the field it names, or under the form for `form`. */
export type CarrierError = { field: CarrierField | "form"; message: string };

export type CarrierChange = FieldChange<CarrierField>;

/**
 * Change-log entry the API writes whenever a carrier is added or edited.
 * Append-only: notes are never edited or deleted.
 */
export type CarrierNote = {
  id: string;
  carrierId: CarrierRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Full name of who made the change, or null when unknown. */
  createdBy: string | null;
  /** Only the fields that changed, in form order. */
  changes: CarrierChange[];
};

/** A carrier as the API serialises it (CarrierSerializer). */
export type ApiCarrier = {
  id: string;
  name: string;
  aliases: string[];
  lines_of_business: string[];
  available_states: string[];
  agent_accessible: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** A note as the API serialises it (CarrierNoteSerializer). */
type ApiCarrierNote = {
  id: string;
  carrier_id: string;
  kind: "added" | "edited";
  changes: { field: string; from: string; to: string }[];
  created_by: string | null;
  created_at: string;
};

/** API field name -> CarrierRecord field, for a note's changes. */
const NOTE_FIELDS: Record<string, CarrierField> = {
  name: "name",
  aliases: "aliases",
  lines_of_business: "linesOfBusiness",
  available_states: "availableStates",
  status: "status",
};

const KNOWN_LINES: readonly string[] = LINES_OF_BUSINESS;

/** An API carrier as the app holds it. A line the app doesn't know is dropped with a console warning. */
export function toCarrierRecord(carrier: ApiCarrier): CarrierRecord {
  const unknown = carrier.lines_of_business.filter((line) => !KNOWN_LINES.includes(line));
  if (unknown.length > 0) {
    console.warn(`Carrier ${carrier.name} has unknown lines of business: ${unknown.join(", ")}.`);
  }
  return {
    id: carrier.id,
    name: carrier.name,
    aliases: carrier.aliases,
    linesOfBusiness: LINES_OF_BUSINESS.filter((line) => carrier.lines_of_business.includes(line)),
    availableStates: [...new Set(carrier.available_states)].sort(),
    status: carrier.is_active ? "active" : "inactive",
    agentAccessible: carrier.agent_accessible,
  };
}

function toCarrierNote(note: ApiCarrierNote): CarrierNote {
  return {
    id: note.id,
    carrierId: note.carrier_id,
    kind: note.kind,
    createdAt: note.created_at,
    createdBy: note.created_by,
    changes: note.changes.flatMap((change) => {
      const field = NOTE_FIELDS[change.field];
      return field ? [{ field, from: change.from, to: change.to }] : [];
    }),
  };
}

/** Every carrier, active and inactive, sorted by name. */
export async function getCarriers(): Promise<CarrierRecord[]> {
  const carriers = await apiGetAll<ApiCarrier>("/carriers/");
  return carriers.map(toCarrierRecord);
}

/** One carrier by ID, or null when there is none (or the ID isn't one). */
export async function getCarrier(id: string): Promise<CarrierRecord | null> {
  const result = await apiFetch<ApiCarrier>(`/carriers/${encodeURIComponent(id)}/`);
  if (!result.ok) {
    if (result.status === 404) return null;
    throw new ApiError(`/carriers/${id}/`, result);
  }
  return toCarrierRecord(result.data);
}

/** One carrier's change notes, newest first. */
export async function getCarrierNotes(carrierId: string): Promise<CarrierNote[]> {
  const notes = await apiGet<ApiCarrierNote[]>(`/carriers/${encodeURIComponent(carrierId)}/notes/`);
  return notes.map(toCarrierNote);
}
