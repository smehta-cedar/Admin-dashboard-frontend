import type { Metadata } from "next";
import { getAgents } from "@/lib/agents";
import { getUserNotes, getUsers } from "@/lib/users";
import { UsersView } from "./users-view";

export const metadata: Metadata = {
  title: "Users",
};

export default async function UsersPage() {
  const [users, notes, agents] = await Promise.all([getUsers(), getUserNotes(), getAgents()]);

  return (
    <UsersView
      initialUsers={users}
      initialNotes={notes}
      // The dialog's Linked agent options; only these three fields are read.
      agents={agents.map(({ id, name, status }) => ({ id, name, status }))}
    />
  );
}
