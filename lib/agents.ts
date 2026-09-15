import "server-only";

/*
 * Data boundary for agents. Today it reads fake agents and notes from
 * data/agents.json and data/agent-notes.json; later it queries Supabase. The
 * JSON is trusted as-is, not validated.
 *
 * Writing numbers are not stored on agents or carriers. They will live with
 * Logins (one agent's producer ID at one carrier).
 *
 * The commission matrix still uses the slim `Agent` ({ id, name }) from
 * commissions.ts. Don't widen that; use AgentRecord here for agent detail.
 */

import agentsJson from "@/data/agents.json";
import notesJson from "@/data/agent-notes.json";

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
  /** National Producer Number. Unique across agents. */
  npn: string;
  email: string;
  /** Stored as entered; no formatting yet. */
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

/** Every agent, active and inactive, in ID order (1, 2, 3, …). */
export async function getAgents(): Promise<AgentRecord[]> {
  return (agentsJson as AgentRecord[]).slice().sort((a, b) => Number(a.id) - Number(b.id));
}

/** Every agent note, newest first. */
export async function getAgentNotes(): Promise<AgentNote[]> {
  return (notesJson as AgentNote[])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
