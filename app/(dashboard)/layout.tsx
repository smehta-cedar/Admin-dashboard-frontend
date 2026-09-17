import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar";

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview" },
  {
    href: "/agents",
    label: "Agents",
    children: [
      // Opens the first agent; stays highlighted on every /agents/<id>.
      { href: "/agents/profile", label: "Agent profile", activePrefix: "/agents/" },
    ],
  },
  {
    href: "/carriers",
    label: "Carriers",
    children: [
      // Opens the first carrier; stays highlighted on every /carriers/<id>.
      { href: "/carriers/profile", label: "Carrier profile", activePrefix: "/carriers/" },
    ],
  },
  { href: "/rulebook", label: "Rulebook" },
  { href: "/logins", label: "Logins" },
  {
    href: "/contracts",
    label: "Contracts",
    children: [
      { href: "/contracts/by-state", label: "By state" },
      { href: "/contracts/by-carriers", label: "By carriers" },
    ],
  },
];

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <AppShell title="Commissions" navItems={NAV_ITEMS}>
      {children}
    </AppShell>
  );
}
