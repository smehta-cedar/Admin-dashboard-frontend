"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { AgentStateLicenseRecord } from "@/lib/agent-state-licenses";
import type { AgentNote, AgentRecord } from "@/lib/agents";
import { saveAgent, type AgentError, type AgentValues } from "./agent-dialog";

/*
 * The Agents section's dummy state: every agent, every agent note and every
 * licence row, plus how many changes were made on this visit. Mounted by
 * app/(dashboard)/agents/layout.tsx, which loads the JSON once, so the list
 * (/agents) and the Add agent page (/agents/new) read and write the same
 * lists — an agent added on the page is in the list when it comes back. Like
 * every other page, nothing reaches a server and a refresh brings back the
 * JSON.
 *
 * The agent profile (/agents/[id]) sits under the same layout but keeps its
 * own state from its own server load: a brand-new agent has no profile until
 * it exists in the JSON.
 */

type AgentsStore = {
  agents: AgentRecord[];
  notes: AgentNote[];
  licenses: AgentStateLicenseRecord[];
  /** Adds and edits made since the page loaded, for the unsaved banner. */
  unsavedCount: number;
  /**
   * Adds an agent, or edits `editing`, through `saveAgent`: the list, notes
   * and licence rows all update at once. Returns the form error, if any.
   */
  save: (values: AgentValues, editing?: AgentRecord) => AgentError | null;
};

const AgentsContext = createContext<AgentsStore | null>(null);

type AgentsProviderProps = {
  initialAgents: AgentRecord[];
  initialNotes: AgentNote[];
  /** Every agent's licence rows: the form edits them and new row IDs need them all. */
  initialLicenses: AgentStateLicenseRecord[];
  children: ReactNode;
};

export function AgentsProvider({
  initialAgents,
  initialNotes,
  initialLicenses,
  children,
}: AgentsProviderProps) {
  const [agents, setAgents] = useState(initialAgents);
  const [notes, setNotes] = useState(initialNotes);
  const [licenses, setLicenses] = useState(initialLicenses);
  const [unsavedCount, setUnsavedCount] = useState(0);

  const save: AgentsStore["save"] = (values, editing) => {
    const result = saveAgent({ agents, notes, licenses, values, editing });
    if (result.error !== null) return result.error;
    if (!result.changed) return null;

    const saved = result.agent;
    setAgents((current) =>
      editing ? current.map((agent) => (agent.id === saved.id ? saved : agent)) : [...current, saved],
    );
    setLicenses(result.licenses);
    setNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    return null;
  };

  return (
    <AgentsContext.Provider value={{ agents, notes, licenses, unsavedCount, save }}>
      {children}
    </AgentsContext.Provider>
  );
}

/** The section's agents state. Only under the agents layout. */
export function useAgentsStore(): AgentsStore {
  const store = useContext(AgentsContext);
  if (!store) throw new Error("useAgentsStore needs an AgentsProvider (app/(dashboard)/agents/layout.tsx).");
  return store;
}
