import "server-only";

/*
 * Data boundary for carrier contracts. Today it reads fake records and notes
 * from data/carrier-contracts.json and data/carrier-contract-notes.json; later
 * it queries Supabase. The JSON is trusted as-is, not validated.
 *
 * A carrier contract says one agent is contracted with one carrier. Presence
 * means contracted, absence means not: there is no contract status. An agent
 * has at most one contract per carrier (enforced in the form for now). Whether
 * the agent is active comes from AgentRecord.status, edited only on Agents.
 *
 * Separate from lib/contracts.ts, which holds state licenses (one record per
 * agent, no carrier). Writing numbers stay with Logins in lib/logins.ts.
 */

import contractsJson from "@/data/carrier-contracts.json";
import notesJson from "@/data/carrier-contract-notes.json";
import type { AgentRecord } from "@/lib/agents";
import type { CarrierRecord } from "@/lib/carriers";

export type CarrierContractRecord = {
  /** Internal ID, numbered 1, 2, 3, … for now. */
  id: string;
  agentId: AgentRecord["id"];
  /** Unique per agent: one contract for each agent with each carrier. */
  carrierId: CarrierRecord["id"];
};

/** Carrier contract fields a note can record. The ID never changes. */
export type CarrierContractField = Exclude<keyof CarrierContractRecord, "id">;

export type CarrierContractChange = {
  field: CarrierContractField;
  /**
   * Value before, as shown in the UI: agent and carrier by name, not ID.
   * Empty for a new contract.
   */
  from: string;
  to: string;
};

/**
 * Change-log entry, written automatically whenever a carrier contract is added
 * or edited. Append-only: notes are never edited or deleted.
 */
export type CarrierContractNote = {
  id: string;
  contractId: CarrierContractRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Only the fields that changed, in form order. */
  changes: CarrierContractChange[];
};

/** Every carrier contract, in ID order (1, 2, 3, …). */
export async function getCarrierContracts(): Promise<CarrierContractRecord[]> {
  return (contractsJson as CarrierContractRecord[])
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id));
}

/** Every carrier contract note, newest first. */
export async function getCarrierContractNotes(): Promise<CarrierContractNote[]> {
  return (notesJson as CarrierContractNote[])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
