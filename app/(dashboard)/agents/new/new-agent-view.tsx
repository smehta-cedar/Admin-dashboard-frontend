"use client";

import { AgentFormPage } from "../agent-form-page";

type PolicyTypeOption = { id: string; name: string; status: "active" | "inactive" };

/** Add agent. Cancel and a successful save return to the list. */
export function NewAgentView({ policyTypes }: { policyTypes: PolicyTypeOption[] | null }) {
  return <AgentFormPage policyTypes={policyTypes} returnTo="/agents" />;
}
