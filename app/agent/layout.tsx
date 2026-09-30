import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar";
import { getSessionUser } from "@/lib/session";

const NAV_ITEMS: NavItem[] = [{ href: "/agent", label: "My profile", icon: "agents" }];

/**
 * Shell for an agent signed in with a work Gmail and a code. Staff keep
 * the dashboard; an agent who opens a staff page is sent here, and a staff
 * account that opens this address is sent to the CRM.
 */
export default async function AgentLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.agentId) redirect("/overview");

  return (
    <AppShell navItems={NAV_ITEMS} user={user} searchIndex={{}} pageTitles={{ "/agent": "My profile" }}>
      {children}
    </AppShell>
  );
}
