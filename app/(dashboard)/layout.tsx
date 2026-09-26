import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RequestsProvider } from "@/components/requests-store";
import type { NavItem } from "@/components/sidebar";
import { getAgents } from "@/lib/agents";
import { getCarriers } from "@/lib/carriers";
import { getRequests } from "@/lib/requests";
import { getSearchIndex } from "@/lib/search-index";
import { getSessionUser } from "@/lib/session";
import { byName } from "@/lib/text";

const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", icon: "overview" },
  {
    href: "/agents",
    label: "Agents",
    icon: "agents",
    searchable: true,
    children: [
      // Opens the first agent; stays highlighted on every /agents/<id>, but
      // not on the Add agent page, which is the section's own.
      {
        href: "/agents/profile",
        label: "Agent profile",
        activePrefix: "/agents/",
        activeExcept: ["/agents/new"],
      },
    ],
  },
  {
    href: "/carriers",
    label: "Carriers",
    icon: "carriers",
    searchable: true,
    children: [
      // Opens the first carrier; stays highlighted on every /carriers/<id>.
      { href: "/carriers/profile", label: "Carrier profile", activePrefix: "/carriers/" },
    ],
  },
  { href: "/rulebook", label: "Rulebook", icon: "rulebook" },
  { href: "/passwords", label: "Passwords", icon: "passwords", searchable: true },
  {
    href: "/contracts",
    label: "Contracts",
    icon: "contracts",
    searchable: true,
    // Contracts itself is the by-state view; by-carriers is the one sub-link.
    children: [{ href: "/contracts/by-carriers", label: "By carriers" }],
  },
  // Requests and the calendar they land on. No role gate, like the rest of the app.
  { href: "/hr", label: "HR", icon: "hr" },
  { href: "/users", label: "Users", icon: "users", searchable: true },
];

/** Pinned to the bottom of the rail: the one org record for this shop. */
const FOOTER_ITEMS: NavItem[] = [{ href: "/agency", label: "Agency", icon: "agency" }];

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Soft gate: no valid fake session, no dashboard. Checked on the server so a
  // signed-out visitor never sees a flash of the app. Not real auth (see
  // lib/fake-session.ts); Supabase Auth replaces it.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // After the gate: the index holds record data, so only a signed-in user gets it.
  // The requests and the dialog's agent and carrier options load here too:
  // the navbar's Create-a-request button is on every page, so the list lives
  // above them all (components/requests-store.tsx).
  const [searchIndex, requests, agents, carriers] = await Promise.all([
    getSearchIndex(),
    getRequests(),
    getAgents(),
    getCarriers(),
  ]);
  const party = ({ id, name, status }: { id: string; name: string; status: "active" | "inactive" }) => ({
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
      <AppShell navItems={NAV_ITEMS} footerItems={FOOTER_ITEMS} user={user} searchIndex={searchIndex}>
        {children}
      </AppShell>
    </RequestsProvider>
  );
}
