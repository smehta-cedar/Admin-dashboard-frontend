import type { NavItem } from "@/components/sidebar";
import { canView, type SessionUser } from "@/lib/auth-user";
import { STATUS_MODULES } from "@/lib/status-sections";

/*
 * The dashboard rail, and which links a user's role shows. Every link names
 * its permission code (backend/apps/accounts/models/roles.py MODULES), one
 * per link, whose view flag shows it; a section's own list page uses
 * `listModule`. The pages check the same flag (lib/access.ts), so a typed URL
 * gets "No access" instead of the API's 403.
 */

const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", icon: "overview", module: "dashboard" },
  {
    href: "/agents",
    label: "Agents",
    listLabel: "Agent list",
    listIcon: "list",
    icon: "agents",
    listModule: "agents.list",
    searchable: true,
    children: [
      // Opens the first agent; stays highlighted on every /agents/<id>, but
      // not on Add agent or Edit agent, which belong to the section.
      {
        href: "/agents/profile",
        label: "Agent profile",
        icon: "profile",
        module: "agents.profile",
        activePrefix: "/agents/",
        activeExcept: ["/agents/new", "/edit"],
      },
    ],
  },
  {
    href: "/carriers",
    label: "Carriers",
    listLabel: "Carrier list",
    listIcon: "list",
    icon: "carriers",
    listModule: "carriers.list",
    searchable: true,
    children: [
      // Opens the first carrier; stays highlighted on every /carriers/<id>,
      // but not on Add carrier or Edit carrier, which belong to the section.
      {
        href: "/carriers/profile",
        label: "Carrier profile",
        icon: "profile",
        module: "carriers.profile",
        activePrefix: "/carriers/",
        activeExcept: ["/carriers/new", "/edit"],
      },
    ],
  },
  // How payouts are calculated, so it goes with the commissions overview.
  { href: "/rulebook", label: "Rulebook", icon: "rulebook", module: "rulebook" },
  { href: "/passwords", label: "Passwords", icon: "passwords", module: "passwords", searchable: true },
  {
    href: "/contracts",
    label: "Contracts",
    listLabel: "By state",
    listIcon: "map",
    icon: "contracts",
    listModule: "contracts.by_state",
    searchable: true,
    // Contracts itself is the by-state view; by-carriers is the one sub-link.
    children: [{ href: "/contracts/by-carriers", label: "By carriers", icon: "carriers", module: "contracts.by_carriers" }],
  },
  // Requests and the calendar they land on.
  { href: "/hr", label: "Calendar", icon: "hr", module: "requests" },
  // What the shop sells, and the shop itself; orders land on HR.
  {
    href: "/storefront",
    label: "Storefront",
    listLabel: "Products",
    listIcon: "tag",
    icon: "storefront",
    listModule: "storefront.products",
    children: [{ href: "/storefront/shop", label: "Shop", icon: "cart", module: "storefront.shop" }],
  },
  { href: "/users", label: "Users", icon: "users", module: "users", searchable: true },
];

/** Shown after Storefront: records by status, across modules (lib/status-sections.ts). */
const STATUS_ITEMS: NavItem[] = [
  { href: "/pending", label: "Pending", icon: "pending", module: STATUS_MODULES },
  { href: "/archive", label: "Archive", icon: "archive", module: STATUS_MODULES },
];

/** Shown after Users to superusers only: the roles page manages what everyone else may do. */
const ROLES_ITEM: NavItem = { href: "/roles", label: "Roles", icon: "roles", searchable: true };

/** Pinned to the bottom of the rail: the one org record for this shop. */
const FOOTER_ITEMS: NavItem[] = [{ href: "/agency", label: "Agency", icon: "agency", module: "agencies" }];

/** Whether the role can see a link; one without a code (Roles) is added only for those who can. */
function allowed(user: SessionUser, module: NavItem["module"]) {
  if (module == null) return true;
  return (typeof module === "string" ? [module] : module).some((code) => canView(user, code));
}

/**
 * The links the role can see. A section whose list page is off opens on its
 * first sub-link instead, and goes when none is left.
 */
function visible(items: NavItem[], user: SessionUser): NavItem[] {
  return items.flatMap((item): NavItem[] => {
    if (!item.children) return allowed(user, item.module) ? [item] : [];
    const children = item.children.filter((child) => allowed(user, child.module));
    if (allowed(user, item.listModule ?? item.module)) return [{ ...item, children }];
    const [first] = children;
    if (!first) return [];
    // Search sends the query to the list page, so it goes with it.
    return [{ ...item, href: first.href, listLabel: undefined, listIcon: undefined, searchable: false, children }];
  });
}

export function navItemsFor(user: SessionUser): NavItem[] {
  const items = [...NAV_ITEMS];
  items.splice(items.findIndex((item) => item.href === "/users"), 0, ...STATUS_ITEMS);
  return visible(user.isSuperuser ? [...items, ROLES_ITEM] : items, user);
}

export function footerItemsFor(user: SessionUser): NavItem[] {
  return visible(FOOTER_ITEMS, user);
}

/** Where to send a user whose role can't see the Overview: the first link they can. */
export function homeFor(user: SessionUser): string | null {
  return navItemsFor(user)[0]?.href ?? null;
}
