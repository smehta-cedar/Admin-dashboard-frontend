import type { NavItem } from "@/components/sidebar";
import { canView, type SessionUser } from "@/lib/auth-user";

/*
 * The dashboard rail, and which links a user's role shows. Each top-level
 * link names the API module (backend/apps/accounts/models/roles.py MODULES)
 * whose view flag shows it; the pages check the same flag (lib/access.ts),
 * so a typed URL gets "No access" instead of the API's 403.
 */

const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", icon: "overview", module: "dashboard" },
  {
    href: "/agents",
    label: "Agents",
    icon: "agents",
    module: "agents",
    searchable: true,
    children: [
      // Opens the first agent; stays highlighted on every /agents/<id>, but
      // not on Add agent or Edit agent, which belong to the section.
      {
        href: "/agents/profile",
        label: "Agent profile",
        activePrefix: "/agents/",
        activeExcept: ["/agents/new", "/edit"],
      },
    ],
  },
  {
    href: "/carriers",
    label: "Carriers",
    icon: "carriers",
    module: "carriers",
    searchable: true,
    children: [
      // Opens the first carrier; stays highlighted on every /carriers/<id>,
      // but not on Add carrier or Edit carrier, which belong to the section.
      {
        href: "/carriers/profile",
        label: "Carrier profile",
        activePrefix: "/carriers/",
        activeExcept: ["/carriers/new", "/edit"],
      },
    ],
  },
  // The catalog of policy kinds; policies and certifications will point at it.
  { href: "/policy-types", label: "Policy types", icon: "policy-types", module: "policy_types" },
  // How payouts are calculated, so it goes with the commissions overview.
  { href: "/rulebook", label: "Rulebook", icon: "rulebook", module: "dashboard" },
  { href: "/passwords", label: "Passwords", icon: "passwords", module: "passwords", searchable: true },
  {
    href: "/contracts",
    label: "Contracts",
    icon: "contracts",
    module: "contracts",
    searchable: true,
    // Contracts itself is the by-state view; by-carriers is the one sub-link.
    children: [{ href: "/contracts/by-carriers", label: "By carriers" }],
  },
  // Requests and the calendar they land on.
  { href: "/hr", label: "HR", icon: "hr", module: "requests" },
  // What the shop sells, and the shop itself; orders land on HR. The shop's
  // catalog is open to everyone, so it stays when Storefront is hidden.
  {
    href: "/storefront",
    label: "Storefront",
    icon: "storefront",
    module: "storefront",
    children: [{ href: "/storefront/shop", label: "Shop", module: null }],
  },
  { href: "/users", label: "Users", icon: "users", module: "users", searchable: true },
];

/** Shown after Users to superusers only: the roles page manages what everyone else may do. */
const ROLES_ITEM: NavItem = { href: "/roles", label: "Roles", icon: "roles", searchable: true };

/** Pinned to the bottom of the rail: the one org record for this shop. */
const FOOTER_ITEMS: NavItem[] = [{ href: "/agency", label: "Agency", icon: "agency", module: "agencies" }];

function allowed(user: SessionUser, module: string | null | undefined, sectionShown: boolean) {
  if (module === null) return true;
  if (module === undefined) return sectionShown;
  return canView(user, module);
}

/**
 * The links the role can see. A hidden section's sub-link that is open on
 * its own (the Shop) moves up to the top level, with the section's icon.
 */
function visible(items: NavItem[], user: SessionUser): NavItem[] {
  return items.flatMap((item): NavItem[] => {
    const shown = allowed(user, item.module, true);
    const children = item.children?.filter((child) => allowed(user, child.module, shown));
    if (shown) return [{ ...item, children }];
    return (children ?? []).map((child) => ({ ...child, icon: item.icon }));
  });
}

export function navItemsFor(user: SessionUser): NavItem[] {
  return visible(user.isSuperuser ? [...NAV_ITEMS, ROLES_ITEM] : NAV_ITEMS, user);
}

export function footerItemsFor(user: SessionUser): NavItem[] {
  return visible(FOOTER_ITEMS, user);
}

/** Where to send a user whose role can't see the Overview: the first link they can. */
export function homeFor(user: SessionUser): string | null {
  return navItemsFor(user)[0]?.href ?? null;
}
