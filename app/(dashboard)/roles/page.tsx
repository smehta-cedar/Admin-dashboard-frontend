import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRoleModules, getRoles } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";
import { RolesView } from "./roles-view";

export const metadata: Metadata = {
  title: "Roles",
};

export default async function RolesPage() {
  // Superusers only: the sidebar hides the link from everyone else, and the
  // API refuses their changes, but a typed URL still lands here.
  const user = await getSessionUser();
  if (!user?.isSuperuser) redirect("/overview");

  const [roles, modules] = await Promise.all([getRoles(), getRoleModules()]);

  return <RolesView initialRoles={roles} modules={modules} />;
}
