import type { Metadata } from "next";
import { getUserNotes, getUsers } from "@/lib/users";
import { UsersView } from "./users-view";

export const metadata: Metadata = {
  title: "Users",
};

export default async function UsersPage() {
  const [users, notes] = await Promise.all([getUsers(), getUserNotes()]);

  return <UsersView initialUsers={users} initialNotes={notes} />;
}
