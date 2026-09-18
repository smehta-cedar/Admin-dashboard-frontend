import "server-only";

/*
 * Data boundary for carrier contracts. Today it reads fake records and notes
 * from data/carrier-contracts.json and data/carrier-contract-notes.json; later
 * it queries Supabase. The JSON is trusted as-is, not validated, except that a
 * record missing appointedStates loads with none (and a console warning), and a
 * missing writingNumber loads as "".
 *
 * A carrier contract (an appointment) says one agent is appointed with one
 * carrier, in the states listed, with the writing number (producer ID) the
 * carrier assigned them. Presence means contracted, absence means not: there
 * is no contract status. An agent has at most one contract per carrier
 * (enforced in the form for now). Empty appointedStates means appointed
 * nowhere yet, never "every state". Empty writingNumber means none recorded
 * yet. Whether the agent is active comes from AgentRecord.status, edited only
 * on Agents.
 *
 * appointedStates must be within both ceilings: the agent's licensedStates
 * (lib/agents.ts) and the carrier's availableStates (lib/carriers.ts). The
 * contract dialog only offers states in both and rejects others on save,
 * naming the side that blocks them. Older rows outside a ceiling load as-is;
 * editing one strips the extras.
 *
 * An appointment is still what makes an agent contracted — a licence alone
 * never does — so Contracts by state is a view over appointments, narrowed to
 * the states the agent and carrier share. Portal username and password stay
 * with Passwords in lib/passwords.ts.
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
   * Producer ID the carrier assigned the agent. Unique within a carrier when
   * set (ignoring case). Empty when none recorded yet.
   */
  writingNumber: string;
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

/** A contract as the JSON may hold it: older rows may omit writingNumber or appointedStates. */
type StoredCarrierContract = Omit<CarrierContractRecord, "appointedStates" | "writingNumber"> & {
  writingNumber?: string;
  appointedStates?: string[];
};

/**
 * Every carrier contract, in ID order (1, 2, 3, …). A record without
 * appointedStates gets [] (with a console warning naming the contract), and a
 * missing writingNumber gets "", so the page still renders it.
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
        writingNumber: typeof contract.writingNumber === "string" ? contract.writingNumber : "",
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
