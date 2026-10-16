import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { getRoles, getUserNotes, getUsers } from "@/lib/users";
import { UsersView } from "./users-view";

export const metadata: Metadata = {
  title: "Users",
};

export default async function UsersPage() {
  if (!(await canViewModule("users"))) return <NoAccess title="Users" />;
  const [users, notes, roles, me] = await Promise.all([getUsers(), getUserNotes(), getRoles(), getSessionUser()]);

  return (
    <UsersView initialUsers={users} notes={notes} roles={roles} canAssignRoles={me?.isSuperuser ?? false} />
  );
}
