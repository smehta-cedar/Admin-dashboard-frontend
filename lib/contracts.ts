import "server-only";

/*
 * Data boundary for contracts. Today it reads fake records and notes from
 * data/contracts.json and data/contract-notes.json; later it queries Supabase.
 * The JSON is trusted as-is, not validated.
 *
 * For now a contract holds state licenses only: one record per agent listing
 * the states that agent is licensed in. Licenses live here, not on
 * AgentRecord, so a later phase can add carrierId (contracts per carrier)
 * without reshaping Agents.
 */

import contractsJson from "@/data/contracts.json";
import notesJson from "@/data/contract-notes.json";
import type { AgentRecord } from "@/lib/agents";

export type ContractStatus = "active" | "inactive";

export type ContractRecord = {
  /** Internal ID, numbered 1, 2, 3, … for now. */
  id: string;
  /** The agent this record belongs to. One record per agent. */
  agentId: AgentRecord["id"];
  /** US state codes from lib/us-states.ts ("TX", "CA", …). Empty when none. */
  licensedStates: string[];
  /** Defaults to "active". Only active records count on the map. */
  status: ContractStatus;
};

/** Contract fields a note can record. The ID never changes. */
export type ContractField = Exclude<keyof ContractRecord, "id">;

export type ContractChange = {
  field: ContractField;
  /**
   * Value before, as shown in the UI: agent by name, states as codes joined
   * with ", ". Empty for a new contract.
   */
  from: string;
  to: string;
};

/**
 * Change-log entry, written automatically whenever a contract is added or
 * edited. Append-only: notes are never edited or deleted.
 */
export type ContractNote = {
  id: string;
  contractId: ContractRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Only the fields that changed, in form order. */
  changes: ContractChange[];
};

/** Every contract, active and inactive, in ID order (1, 2, 3, …). */
export async function getContracts(): Promise<ContractRecord[]> {
  return (contractsJson as ContractRecord[]).slice().sort((a, b) => Number(a.id) - Number(b.id));
}

/** Every contract note, newest first. */
export async function getContractNotes(): Promise<ContractNote[]> {
  return (notesJson as ContractNote[])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
