import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar";

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/agents", label: "Agents" },
  { href: "/rulebook", label: "Rulebook" },
  { href: "/logins", label: "Logins" },
  { href: "/contracts", label: "Contracts" },
  { href: "/carriers", label: "Carriers" },
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
