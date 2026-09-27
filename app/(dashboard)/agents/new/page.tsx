import type { Metadata } from "next";
import { allowForbidden } from "@/lib/api-server";
import { getPolicyTypes } from "@/lib/policy-types";
import { NewAgentView } from "./new-agent-view";

export const metadata: Metadata = {
  title: "Add agent",
};

/**
 * Add agent as a page rather than a dialog. The static `new` segment wins
 * over the dynamic `[id]` beside it. The form and its save come from the
 * section's store (../agents-store.tsx), so the new agent is in the list on
 * the way back. Policy types feed the certification list; a role that can't
 * see them gets the page without that section.
 */
export default async function NewAgentPage() {
  // Null for a role without policy types view: the page then hides certifications.
  const policyTypes = await allowForbidden(getPolicyTypes());

  return (
    <NewAgentView
      policyTypes={policyTypes?.map(({ id, name, status }) => ({ id, name, status })) ?? null}
    />
  );
}
