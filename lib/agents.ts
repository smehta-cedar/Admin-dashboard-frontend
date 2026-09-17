import "server-only";

/*
 * Data boundary for agents. Today it reads fake agents and notes from
 * data/agents.json and data/agent-notes.json; later it queries Supabase. The
 * JSON is trusted as-is, not validated, except that an agent missing
 * licensedStates loads with none (and a console warning) and phones load in
 * the one display format (lib/phone.ts).
 *
 * licensedStates is the agent's own resident/non-resident licences: where they
 * may write at all, whoever the carrier. It is one of the two ceilings on an
 * appointment — the other is the carrier's availableStates (lib/carriers.ts).
 * An agent can write with a carrier in a state only when the state is in both,
 * and an appointment lists it. Empty means licensed nowhere, never "everywhere".
 *
 * Writing numbers are not stored on agents or carriers. They live with
 * Logins in lib/logins.ts (one agent's producer ID at one carrier).
 *
 * The commission matrix still uses the slim `Agent` ({ id, name }) from
 * commissions.ts. Don't widen that; use AgentRecord here for agent detail.
 */

import agentsJson from "@/data/agents.json";
import notesJson from "@/data/agent-notes.json";
import { formatPhone } from "@/lib/phone";

export type AgentStatus = "active" | "inactive";

export type AgentRecord = {
  /** Internal ID, numbered 1, 2, 3, … for now. Not the NPN or a writing number. */
  id: string;
  /** Legal / full name. */
  name: string;
  /** Other names seen on statements (DBA, nickname, maiden). Empty when none. */
  aliases: string[];
  /** Defaults to "active" when adding. */
  status: AgentStatus;
  /**
   * US state codes from lib/us-states.ts the agent holds a licence in, unique
   * and in code order. Empty when licensed nowhere yet (not "all states").
   */
  licensedStates: string[];
  /** National Producer Number. Unique across agents. */
  npn: string;
  email: string;
  /** "(555)010-4410" (formatPhone); other lengths stay as entered. */
  phone: string;
};

/** Agent fields a note can record. The ID never changes. */
export type AgentField = Exclude<keyof AgentRecord, "id">;

export type AgentChange = {
  field: AgentField;
  /** Value before, as shown in the UI (aliases joined with ", "). Empty for a new agent. */
  from: string;
  to: string;
};

/**
 * Change-log entry, written automatically whenever an agent is added or edited.
 * Append-only: notes are never edited or deleted.
 */
export type AgentNote = {
  id: string;
  agentId: AgentRecord["id"];
  kind: "added" | "edited";
  /** ISO 8601 timestamp in UTC, e.g. "2026-09-02T14:05:00.000Z". */
  createdAt: string;
  /** Only the fields that changed, in form order. */
  changes: AgentChange[];
};

/** An agent as the JSON may hold it: older rows have no licensedStates. */
type StoredAgent = Omit<AgentRecord, "licensedStates"> & { licensedStates?: string[] };

/**
 * A stored agent with licensedStates unique and in code order, and the phone
 * in the display format. Missing licensedStates becomes [] (with a console
 * warning naming the agent).
 */
function toRecord(agent: StoredAgent): AgentRecord {
  if (!Array.isArray(agent.licensedStates)) {
    console.warn(`Agent ${agent.id} has no licensedStates; treating them as licensed in no states.`);
  }
  const states = Array.isArray(agent.licensedStates) ? agent.licensedStates : [];
  return {
    ...agent,
    phone: formatPhone(agent.phone),
    licensedStates: [...new Set(states)].sort(),
  };
}

/** Every agent, active and inactive, in ID order (1, 2, 3, …). */
export async function getAgents(): Promise<AgentRecord[]> {
  return (agentsJson as StoredAgent[]).map(toRecord).sort((a, b) => Number(a.id) - Number(b.id));
}

/** One agent by internal ID, or null when there is none. */
export async function getAgent(id: string): Promise<AgentRecord | null> {
  const agent = (agentsJson as StoredAgent[]).find((stored) => stored.id === id);
  return agent ? toRecord(agent) : null;
}

/** Every agent note, newest first. */
export async function getAgentNotes(): Promise<AgentNote[]> {
  return (notesJson as AgentNote[])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
