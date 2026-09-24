import type { Metadata } from "next";
import { NewAgentView } from "./new-agent-view";

export const metadata: Metadata = {
  title: "Add agent",
};

/**
 * Add agent as a page rather than a dialog. The static `new` segment wins
 * over the dynamic `[id]` beside it. The form and its save come from the
 * section's store (../agents-store.tsx), so the new agent is in the list on
 * the way back.
 */
export default function NewAgentPage() {
  return <NewAgentView />;
}
