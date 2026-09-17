import "server-only";

/*
 * Data boundary for carrier contracts. Today it reads fake records and notes
 * from data/carrier-contracts.json and data/carrier-contract-notes.json; later
 * it queries Supabase. The JSON is trusted as-is, not validated, except that a
 * record missing appointedStates loads with none (and a console warning).
 *
 * A carrier contract (an appointment) says one agent is appointed with one
 * carrier, in the states listed. Presence means contracted, absence means not:
 * there is no contract status. An agent has at most one contract per carrier
 * (enforced in the form for now). Empty appointedStates means appointed
 * nowhere yet, never "every state". Whether the agent is active comes from
 * AgentRecord.status, edited only on Agents.
 *
 * appointedStates must be a subset of the carrier's availableStates
 * (lib/carriers.ts): the contract dialog only offers those states and rejects
 * others on save. Older rows outside the ceiling load as-is; editing one strips
 * the extras.
 *
 * Appointments are the source of truth for where an agent can write: Contracts
 * by state is a view over them. Writing numbers stay with Logins in lib/logins.ts.
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
  /**
   * US state codes from lib/us-states.ts the agent is appointed in with this
   * carrier. Empty when appointed nowhere yet (not "all states"). Always within
   * the carrier's availableStates.
   */
  appointedStates: string[];
};

/** Carrier contract fields a note can record. The ID never changes. */
export type CarrierContractField = Exclude<keyof CarrierContractRecord, "id">;

export type CarrierContractChange = {
  field: CarrierContractField;
  /**
   * Value before, as shown in the UI: agent and carrier by name, not ID;
   * states as codes joined with ", ". Empty for a new contract.
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

/** A contract as the JSON may hold it: older rows have no appointedStates. */
type StoredCarrierContract = Omit<CarrierContractRecord, "appointedStates"> & {
  appointedStates?: string[];
};

/**
 * Every carrier contract, in ID order (1, 2, 3, …). A record without
 * appointedStates gets [] (with a console warning naming the contract), so the
 * page still renders it.
 */
export async function getCarrierContracts(): Promise<CarrierContractRecord[]> {
  return (contractsJson as StoredCarrierContract[])
    .map((contract) => {
      if (!Array.isArray(contract.appointedStates)) {
        console.warn(
          `Carrier contract ${contract.id} has no appointedStates; treating it as appointed in no states.`,
        );
      }
      return {
        ...contract,
        appointedStates: Array.isArray(contract.appointedStates) ? contract.appointedStates : [],
      };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}

/** Every carrier contract note, newest first. */
export async function getCarrierContractNotes(): Promise<CarrierContractNote[]> {
  return (notesJson as CarrierContractNote[])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
