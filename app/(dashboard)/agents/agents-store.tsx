"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { AgentStateLicenseRecord } from "@/lib/agent-state-licenses";
import type { AgentRecord } from "@/lib/agents";
import { byName } from "@/lib/text";
import { saveAgent, type SaveAgentResult } from "./actions";
import type { AgentError, AgentValues } from "./agent-dialog";

/*
 * The Agents section's state: every agent and every licence row, loaded once
 * by app/(dashboard)/agents/layout.tsx from the API and shared by the list
 * (/agents) and the Add agent page (/agents/new), so an agent added on the
 * page is in the list when it comes back. Saves go through the saveAgent
 * server action; the API writes the notes, read on the profile. The action
 * revalidates the section too, so the next server render agrees with what
 * is set here.
 *
 * The agent profile (/agents/[id]) sits under the same layout but keeps its
 * own state from its own server load.
 */

type AgentsStore = {
  agents: AgentRecord[];
  licenses: AgentStateLicenseRecord[];
  /**
   * Adds an agent, or edits `editing`, through the API: the list and the
   * licence rows update at once. Resolves with the form error, if any.
   */
  save: (values: AgentValues, editing?: AgentRecord) => Promise<AgentError | null>;
  /**
   * The same save, returning the saved agent. The Add agent page uses it so
   * it can create certifications for that agent before leaving the page.
   */
  commit: (values: AgentValues, editingId?: string) => Promise<SaveAgentResult>;
  /** Puts a saved agent and their licence rows into the lists, replacing that agent if they are already there. */
  apply: (agent: AgentRecord, licenses: AgentStateLicenseRecord[]) => void;
};

const AgentsContext = createContext<AgentsStore | null>(null);

type AgentsProviderProps = {
  initialAgents: AgentRecord[];
  /** Every agent's licence rows. */
  initialLicenses: AgentStateLicenseRecord[];
  children: ReactNode;
};

export function AgentsProvider({ initialAgents, initialLicenses, children }: AgentsProviderProps) {
  const [agents, setAgents] = useState(initialAgents);
  const [licenses, setLicenses] = useState(initialLicenses);

  const record = (saved: AgentRecord, savedLicenses: AgentStateLicenseRecord[]) => {
    setAgents((current) => {
      const exists = current.some((agent) => agent.id === saved.id);
      return (exists ? current.map((agent) => (agent.id === saved.id ? saved : agent)) : [...current, saved]).sort(
        byName,
      );
    });
    // This agent's rows are replaced by what the API now holds; the rest stay.
    setLicenses((current) => [
      ...current.filter((license) => license.agentId !== saved.id),
      ...savedLicenses,
    ]);
  };

  const commit: AgentsStore["commit"] = async (values, editingId) => {
    const result = await saveAgent(values, editingId);
    if (result.ok) record(result.agent, result.licenses);
    return result;
  };

  const save: AgentsStore["save"] = async (values, editing) => {
    const result = await commit(values, editing?.id);
    return result.ok ? null : result.error;
  };

  return (
    <AgentsContext.Provider value={{ agents, licenses, save, commit, apply: record }}>{children}</AgentsContext.Provider>
  );
}

/** The section's agents state. Only under the agents layout. */
export function useAgentsStore(): AgentsStore {
  const store = useContext(AgentsContext);
  if (!store) throw new Error("useAgentsStore needs an AgentsProvider (app/(dashboard)/agents/layout.tsx).");
  return store;
}
