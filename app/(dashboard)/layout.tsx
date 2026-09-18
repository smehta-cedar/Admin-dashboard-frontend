import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar";
import { getSessionUser } from "@/lib/session";

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: "overview" },
  {
    href: "/agents",
    label: "Agents",
    icon: "agents",
    children: [
      // Opens the first agent; stays highlighted on every /agents/<id>.
      { href: "/agents/profile", label: "Agent profile", activePrefix: "/agents/" },
    ],
  },
  {
    href: "/carriers",
    label: "Carriers",
    icon: "carriers",
    children: [
      // Opens the first carrier; stays highlighted on every /carriers/<id>.
      { href: "/carriers/profile", label: "Carrier profile", activePrefix: "/carriers/" },
    ],
  },
  { href: "/rulebook", label: "Rulebook", icon: "rulebook" },
  { href: "/logins", label: "Logins", icon: "logins" },
  {
    href: "/contracts",
    label: "Contracts",
    icon: "contracts",
    // Contracts itself is the by-state view; by-carriers is the one sub-link.
    children: [{ href: "/contracts/by-carriers", label: "By carriers" }],
  },
  { href: "/users", label: "Users", icon: "users" },
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

  return (
    <AppShell title="" navItems={NAV_ITEMS} footerItems={FOOTER_ITEMS} user={user}>
      {children}
    </AppShell>
  );
}
