import type { Metadata } from "next";
import { connection } from "next/server";
import { getAgents } from "@/lib/agents";
import { getCarriers } from "@/lib/carriers";
import { getPasswordNotes, getPasswords } from "@/lib/passwords";
import { PasswordsView } from "./passwords-view";

export const metadata: Metadata = {
  title: "Passwords",
};

export default async function PasswordsPage() {
  // The carrier filter (?carrier=) reads search params with useSearchParams.
  // Rendering per request lets the server render the filtered table; a
  // prerendered page would need a Suspense boundary and render the whole table
  // on the client instead.
  await connection();

  const [passwords, notes, agents, carriers] = await Promise.all([
    getPasswords(),
    getPasswordNotes(),
    getAgents(),
    getCarriers(),
  ]);

  return (
    <PasswordsView
      initialPasswords={passwords}
      initialNotes={notes}
      agents={agents.map(({ id, name, status }) => ({ id, name, status }))}
      carriers={carriers.map(({ id, name, status }) => ({ id, name, status }))}
    />
  );
}
