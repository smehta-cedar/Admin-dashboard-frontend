import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar";

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
];

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <AppShell title="" navItems={NAV_ITEMS}>
      {children}
    </AppShell>
  );
}
