import type { Metadata } from "next";
import { AgentsView } from "./agents-view";

export const metadata: Metadata = {
  title: "Agents",
};

/** The data comes from the section's layout (./layout.tsx), through the agents store. */
export default function AgentsPage() {
  return <AgentsView />;
}
