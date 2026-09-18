import "server-only";

/*
 * Data boundary for carriers. Today it reads carriers and notes from
 * data/carriers.json and data/carrier-notes.json; later it queries Supabase.
 * The JSON is trusted as-is, not validated, except that a carrier missing
 * availableStates loads with none (and a console warning).
 *
 * A carrier is listed once however many lines of business it writes (e.g.
 * HealthSpring is both MAPD and Supp/Ancillary). Writing numbers are not
 * stored on carriers; they live on carrier contracts in
 * lib/carrier-contracts.ts. Portal username and password live with Name
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
 */

import carriersJson from "@/data/carriers.json";
import notesJson from "@/data/carrier-notes.json";
import type { LineOfBusiness } from "@/lib/lines-of-business";

export type { LineOfBusiness } from "@/lib/lines-of-business";

export type CarrierStatus = "active" | "inactive";

export type CarrierRecord = {
  /** Internal ID, numbered 1, 2, 3, … for now. Not a carrier code. */
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
  /** Defaults to "active" when adding. */
  status: CarrierStatus;
};

/** Carrier fields a note can record. The ID never changes. */
export type CarrierField = Exclude<keyof CarrierRecord, "id">;

export type CarrierChange = {
  field: CarrierField;
  /** Value before, as shown in the UI (lists joined with ", "). Empty for a new carrier. */
  from: string;
  to: string;
};

/**
 * Change-log entry, written automatically whenever a carrier is added or edited.
 * Append-only: notes are never edited or deleted.
 */
export type CarrierNote = {
  id: string;
  carrierId: CarrierRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Only the fields that changed, in form order. */
  changes: CarrierChange[];
};

/** A carrier as the JSON may hold it: older rows have no availableStates. */
type StoredCarrier = Omit<CarrierRecord, "availableStates"> & { availableStates?: string[] };

/**
 * A stored carrier with availableStates unique and in code order. Missing
 * availableStates becomes [] (with a console warning naming the carrier).
 */
function toRecord(carrier: StoredCarrier): CarrierRecord {
  if (!Array.isArray(carrier.availableStates)) {
    console.warn(
      `Carrier ${carrier.id} has no availableStates; treating it as available in no states.`,
    );
  }
  const states = Array.isArray(carrier.availableStates) ? carrier.availableStates : [];
  return { ...carrier, availableStates: [...new Set(states)].sort() };
}

/** Every carrier, active and inactive, in ID order (1, 2, 3, …). */
export async function getCarriers(): Promise<CarrierRecord[]> {
  return (carriersJson as StoredCarrier[]).map(toRecord).sort((a, b) => Number(a.id) - Number(b.id));
}

/** One carrier by internal ID, or null when there is none. */
export async function getCarrier(id: string): Promise<CarrierRecord | null> {
  const carrier = (carriersJson as StoredCarrier[]).find((stored) => stored.id === id);
  return carrier ? toRecord(carrier) : null;
}

/** Every carrier note, newest first. */
export async function getCarrierNotes(): Promise<CarrierNote[]> {
  return (notesJson as CarrierNote[])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
