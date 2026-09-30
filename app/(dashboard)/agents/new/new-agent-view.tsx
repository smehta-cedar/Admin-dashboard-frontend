"use client";

import type { CertifiablePolicyType } from "@/lib/certification-options";
import { AgentFormPage } from "../agent-form-page";

/** Add agent. Cancel and a successful save return to the list. */
export function NewAgentView({ policyTypes }: { policyTypes: CertifiablePolicyType[] | null }) {
  return <AgentFormPage policyTypes={policyTypes} returnTo="/agents" />;
}
