import "server-only";

/*
 * Data boundary for carrier contracts (appointments): reads the Django API
 * (backend/apps/contracts, `/api/v1/contracts/`) as the signed-in user. Adds
 * and edits go through the server action in
 * app/(dashboard)/contracts/actions.ts; the API records a change note on
 * every add and every edit that changed something.
 *
 * A carrier contract says one agent is appointed with one carrier, in the
 * states listed, with the writing number (producer ID) the carrier assigned
 * them. Presence means contracted, absence means not: there is no contract
 * status. An agent has at most one contract per carrier (the API enforces
 * it). Empty appointedStates means appointed nowhere yet, never "every
 * state". Empty writingNumber means none recorded yet. Whether the agent is
 * active comes from AgentRecord.status, edited only on Agents.
 *
 * appointedStates must be within both ceilings: the agent's licensedStates
 * (lib/agents.ts) and the carrier's availableStates (lib/carriers.ts). The
 * contract dialog only offers states in both, and the API rejects others,
 * naming the side that blocks them. Older rows outside a ceiling load as-is;
 * editing one strips the extras.
 *
 * An appointment is still what makes an agent contracted — a licence alone
 * never does — so Contracts by state is a view over appointments, narrowed to
 * the states the agent and carrier share. Portal username and password stay
 * with Passwords in lib/passwords.ts.
 *
 * data/carrier-contracts.json is no longer read here; it is the seed file
 * for `python manage.py seed_contracts`.
 */

import type { AgentRecord } from "@/lib/agents";
import { apiGet, apiGetAll } from "@/lib/api-server";
import type { CarrierRecord } from "@/lib/carriers";
import type { FieldChange } from "@/lib/change-notes";

export type CarrierContractRecord = {
  /** The API's UUID. */
  id: string;
  agentId: AgentRecord["id"];
  /** The agent's name as of the read, for display without another lookup. */
  agentName: string;
  /** Unique per agent: one contract for each agent with each carrier. */
  carrierId: CarrierRecord["id"];
  carrierName: string;
  /**
   * Producer ID the carrier assigned the agent. Unique within a carrier when
   * set (ignoring case). Empty when none recorded yet.
   */
  writingNumber: string;
  /**
   * US state codes from lib/us-states.ts the agent is appointed in with this
   * carrier, unique and in code order. Empty when appointed nowhere yet (not
   * "all states"). Always within the carrier's availableStates.
   */
  appointedStates: string[];
};

/** Carrier contract fields a note can record. The ID and the looked-up names never change on their own. */
export type CarrierContractField = Exclude<keyof CarrierContractRecord, "id" | "agentName" | "carrierName">;

/** What the add / edit dialog submits. */
export type AppointmentValues = Pick<CarrierContractRecord, CarrierContractField>;

/** A save error, shown under the field it names, or under the form for `form`. */
export type AppointmentError = {
  field: "agentId" | "carrierId" | "writingNumber" | "appointedStates" | "form";
  message: string;
};

export type CarrierContractChange = FieldChange<CarrierContractField>;

/**
 * Change-log entry the API writes whenever a carrier contract is added or
 * edited. Append-only: notes are never edited or deleted.
 */
export type CarrierContractNote = {
  id: string;
  contractId: CarrierContractRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Full name of who made the change, or null when unknown. */
  createdBy: string | null;
  /** Only the fields that changed, in form order. */
  changes: CarrierContractChange[];
};

/** A contract as the API serialises it (ContractSerializer). */
export type ApiContract = {
  id: string;
  agent: { id: string; name: string; is_active: boolean };
  carrier: { id: string; name: string; is_active: boolean };
  writing_number: string;
  appointed_states: string[];
  created_at: string;
  updated_at: string;
};

/** A note as the API serialises it (ContractNoteSerializer). */
type ApiContractNote = {
  id: string;
  contract_id: string;
  kind: "added" | "edited";
  changes: { field: string; from: string; to: string }[];
  created_by: string | null;
  created_at: string;
};

/** API field name -> CarrierContractRecord field, for a note's changes. */
const NOTE_FIELDS: Record<string, CarrierContractField> = {
  agent: "agentId",
  carrier: "carrierId",
  writing_number: "writingNumber",
  appointed_states: "appointedStates",
};

/** An API contract as the app holds it. */
export function toContractRecord(contract: ApiContract): CarrierContractRecord {
  return {
    id: contract.id,
    agentId: contract.agent.id,
    agentName: contract.agent.name,
    carrierId: contract.carrier.id,
    carrierName: contract.carrier.name,
    writingNumber: contract.writing_number,
    appointedStates: [...new Set(contract.appointed_states)].sort(),
  };
}

function toContractNote(note: ApiContractNote): CarrierContractNote {
  return {
    id: note.id,
    contractId: note.contract_id,
    kind: note.kind,
    createdAt: note.created_at,
    createdBy: note.created_by,
    changes: note.changes.flatMap((change) => {
      const field = NOTE_FIELDS[change.field];
      return field ? [{ field, from: change.from, to: change.to }] : [];
    }),
  };
}

/** Every carrier contract, by agent name then carrier name. */
export async function getCarrierContracts(): Promise<CarrierContractRecord[]> {
  const contracts = await apiGetAll<ApiContract>("/contracts/");
  return contracts.map(toContractRecord);
}

/** Every live contract's change notes, newest first (the Contracts page's expandable rows). */
export async function getCarrierContractNotes(): Promise<CarrierContractNote[]> {
  const notes = await apiGetAll<ApiContractNote>("/contracts/notes/");
  return notes.map(toContractNote);
}

/** One contract's change notes, newest first. */
export async function getContractNotes(contractId: string): Promise<CarrierContractNote[]> {
  const notes = await apiGet<ApiContractNote[]>(`/contracts/${encodeURIComponent(contractId)}/notes/`);
  return notes.map(toContractNote);
}
