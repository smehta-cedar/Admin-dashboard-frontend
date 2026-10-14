import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RequestsProvider } from "@/components/requests-store";
import type { NavItem } from "@/components/sidebar";
import { getMyRequests } from "@/lib/agent-requests";
import { getAgentHome } from "@/lib/agent-home";
import { canCreate, canView } from "@/lib/auth-user";
import { getSessionUser } from "@/lib/session";

/**
 * Shell for an agent signed in with a work Gmail and a code. Staff keep
 * the dashboard; an agent who opens a staff page is sent here, and a staff
 * account that opens this address is sent to the CRM.
 *
 * When My requests is granted, the Calendar link and the requests store
 * (for the create dialog and the calendar page) are mounted here.
 */
export default async function AgentLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.agentId) redirect("/overview");

  const showCalendar = canView(user, "agent_view.requests");
  const navItems: NavItem[] = [
    { href: "/agent", label: "My profile", icon: "agents" },
    ...(showCalendar ? [{ href: "/agent/calendar", label: "Calendar", icon: "hr" as const }] : []),
  ];

  const pageTitles: Record<string, string> = {
    "/agent": "My profile",
    "/agent/calendar": "Calendar",
  };

  const shell = (
    <AppShell navItems={navItems} user={user} searchIndex={{}} pageTitles={pageTitles}>
      {children}
    </AppShell>
  );

  if (!showCalendar && !canCreate(user, "agent_view.requests")) {
    return shell;
  }

  const [mine, home] = await Promise.all([getMyRequests(), getAgentHome()]);
  const agent = home?.agent;
  const agents = agent
    ? [{ id: agent.id, name: agent.name, status: agent.status }]
    : user.agentId
      ? [{ id: user.agentId, name: user.name, status: "active" as const }]
      : [];

  return (
    <RequestsProvider
      initialRequests={mine?.requests ?? []}
      agents={agents}
      carriers={mine?.carriers ?? []}
    >
      {shell}
    </RequestsProvider>
  );
}
