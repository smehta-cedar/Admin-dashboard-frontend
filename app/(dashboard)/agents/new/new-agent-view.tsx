"use client";

import type { CertifiableCarrier } from "@/lib/certification-options";
import { AgentFormPage } from "../agent-form-page";

/** Add agent. Cancel and a successful save return to the list. */
export function NewAgentView({ carriers }: { carriers: CertifiableCarrier[] | null }) {
  return <AgentFormPage carriers={carriers} returnTo="/agents" />;
}
