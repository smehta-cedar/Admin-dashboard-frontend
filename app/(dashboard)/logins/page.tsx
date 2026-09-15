import type { Metadata } from "next";
import { connection } from "next/server";
import { getAgents } from "@/lib/agents";
import { getCarriers } from "@/lib/carriers";
import { getLoginNotes, getLogins } from "@/lib/logins";
import { LoginsView } from "./logins-view";

export const metadata: Metadata = {
  title: "Logins",
};

export default async function LoginsPage() {
  // The carrier filter (?carrier=) reads search params with useSearchParams.
  // Rendering per request lets the server render the filtered table; a
  // prerendered page would need a Suspense boundary and render the whole table
  // on the client instead.
  await connection();

  const [logins, notes, agents, carriers] = await Promise.all([
    getLogins(),
    getLoginNotes(),
    getAgents(),
    getCarriers(),
  ]);

  return (
    <LoginsView
      initialLogins={logins}
      initialNotes={notes}
      agents={agents.map(({ id, name, status }) => ({ id, name, status }))}
      carriers={carriers.map(({ id, name, status }) => ({ id, name, status }))}
    />
  );
}
