import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar";

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/agents", label: "Agents" },
  { href: "/carriers", label: "Carriers" },
  { href: "/rulebook", label: "Rulebook" },
  { href: "/logins", label: "Logins" },
  { href: "/contracts", label: "Contracts" },

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
