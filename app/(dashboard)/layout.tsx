import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RequestsProvider, type RequestParty } from "@/components/requests-store";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCarriers } from "@/lib/carriers";
import { getRequests } from "@/lib/requests";
import { getSearchIndex } from "@/lib/search-index";
import { getSessionUser } from "@/lib/session";
import { byName } from "@/lib/text";
import { footerItemsFor, navItemsFor } from "./nav";

/** Reached from the navbar's account menu, not the rail, so the title is listed here. */
const PAGE_TITLES: Record<string, string> = { "/profile": "My profile" };

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Gate: no valid session, no dashboard. Checked on the server so a
  // signed-out visitor never sees a flash of the app. getSessionUser asks
  // the API with the access-token cookie (lib/session.ts); the proxy has
  // already refreshed an expiring token by this point.
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Agents have their own view, outside this shell.
  if (user.agentId) redirect("/agent");

  // After the gate: the index holds record data, so only a signed-in user gets it.
  // The requests and the dialog's agent and carrier options load here too:
  // the navbar's Create-a-request button is on every page, so the list lives
  // above them all (components/requests-store.tsx). A role that can't see
  // one of these lists (a 403) gets it empty instead of a broken dashboard.
  const [searchIndex, requests, agents, carriers] = await Promise.all([
    getSearchIndex(),
    allowForbidden(getRequests()).then((list) => list ?? []),
    allowForbidden(getAgents()).then((list) => list ?? []),
    allowForbidden(getCarriers()).then((list) => list ?? []),
  ]);
  const party = ({ id, name, status }: RequestParty) => ({
    id,
    name,
    status,
  });

  return (
    <RequestsProvider
      initialRequests={requests}
      agents={agents.map(party).sort(byName)}
      carriers={carriers.map(party).sort(byName)}
    >
      <AppShell
        navItems={navItemsFor(user)}
        footerItems={footerItemsFor(user)}
        user={user}
        searchIndex={searchIndex}
        pageTitles={PAGE_TITLES}
      >
        {children}
      </AppShell>
    </RequestsProvider>
  );
}
