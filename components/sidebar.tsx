import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon, type NavIconName } from "./nav-icons";

/*
 * Client-only: reads the pathname to mark the active link. Rendered by
 * AppShell, which is the client boundary, so it has no directive of its own.
 */

export type NavItem = {
  href: string;
  label: string;
  /**
   * Marks the link active for any path under this prefix instead of its own
   * href, e.g. a link to one profile that stands for all of them.
   */
  activePrefix?: string;
  /** Paths under `activePrefix` that are not this link's, e.g. /agents/new under /agents/. */
  activeExcept?: string[];
  /** Leading icon; sub-links carry a smaller one. */
  icon?: NavIconName;
  /** Sub-links rendered indented under this item. */
  children?: NavItem[];
  /**
   * With children, the item's own page as the first sub-link, e.g. "Agent
   * list"; the item itself then renders as a small subsection heading.
   */
  listLabel?: string;
  /** Icon for the `listLabel` sub-link. */
  listIcon?: NavIconName;
  /**
   * The page lists its records in a `DataTable`, so the navbar search offers
   * it as a scope and sends the query there as `?q=`.
   */
  searchable?: boolean;
  /**
   * The API module whose view flag shows this link (app/(dashboard)/nav.ts
   * filters on the server). null: every signed-in user. Left out on a
   * sub-link: shown with its section.
   */
  module?: string | null;
};

type SidebarProps = {
  items: NavItem[];
  /** Called when any link is clicked, e.g. to close the mobile drawer. */
  onLinkClick?: () => void;
  /** Icons-only rail: labels and sub-links move into a hover flyout. */
  collapsed?: boolean;
};

/** "/" matches only itself (kept for any future root link); other items also match their nested routes. */
function isActive(pathname: string, href: string, activePrefix?: string, activeExcept: string[] = []) {
  const excepted = activeExcept.some((path) => pathname === path || pathname.endsWith(path));
  if (activePrefix) return pathname.startsWith(activePrefix) && !excepted;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Label of the link the sidebar marks current, for the navbar's page title:
 * the matching sub-link if there is one ("By carriers"), else the section.
 */
export function currentNavLabel(items: NavItem[], pathname: string) {
  for (const item of items) {
    if (pathname === item.href) return item.label;
    const child = item.children?.find((link) =>
      isActive(pathname, link.href, link.activePrefix, link.activeExcept),
    );
    if (child) return child.label;
    if (isActive(pathname, item.href)) return item.label;
  }
  return undefined;
}

/* The rail's link classes. */
export const LINK_BASE = "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium";
/* Inset bar on the left edge marks the current page in the logo teal. */
export const LINK_ACTIVE = "bg-brand-soft text-brand-ink shadow-[inset_3px_0_0_var(--color-brand)]";
export const LINK_IDLE = "text-fg-muted hover:bg-brand-soft/60 hover:text-fg";
/** An ancestor of the current page: selected, but not the page itself. */
const LINK_ANCESTOR = "text-brand-ink hover:bg-brand-soft/60";

/** Small subsection heading over a section's sub-links. */
const HEADING_CLASS = "flex items-center gap-1.5 px-3 pt-3 pb-1 text-[0.625rem] font-semibold uppercase tracking-wider";

/** A section's sub-links, its own page first when it has a `listLabel`. */
function sectionLinks(item: NavItem, pathname: string) {
  const children = item.children ?? [];
  const links = children.map((child) => ({
    href: child.href,
    label: child.label,
    icon: child.icon,
    active: isActive(pathname, child.href, child.activePrefix, child.activeExcept),
  }));
  if (!item.listLabel || children.length === 0) return links;
  // The list owns the section's other paths (Add, Edit) unless a sub-link claims them.
  const listActive = isActive(pathname, item.href) && !links.some((link) => link.active);
  return [{ href: item.href, label: item.listLabel, icon: item.listIcon, active: listActive }, ...links];
}

export function Sidebar({ items, onLinkClick, collapsed }: SidebarProps) {
  const pathname = usePathname();

  const subLinkList = (links: ReturnType<typeof sectionLinks>, className: string) => (
    <ul className={className}>
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            onClick={onLinkClick}
            aria-current={link.active ? "page" : undefined}
            className={`${LINK_BASE} ${link.active ? LINK_ACTIVE : LINK_IDLE}`}
          >
            {link.icon && <NavIcon name={link.icon} className="size-4 shrink-0" />}
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <nav aria-label="Main" className={collapsed ? "px-2 py-4" : "px-3 py-4"}>
      <ul className="space-y-1">
        {items.map((item) => {
          const links = sectionLinks(item, pathname);
          const activeChild = links.some((link) => link.active);
          const active = links.length ? pathname === item.href && !activeChild : isActive(pathname, item.href);

          if (collapsed) {
            return (
              <li key={item.href} className="group relative">
                <Link
                  href={item.href}
                  onClick={onLinkClick}
                  aria-current={active ? "page" : undefined}
                  className={`${LINK_BASE} ${active ? LINK_ACTIVE : activeChild ? LINK_ANCESTOR : LINK_IDLE} justify-center px-0`}
                >
                  {item.icon && <NavIcon name={item.icon} className="size-5 shrink-0" />}
                  {/* The label still names the link for screen readers; the flyout shows it to everyone else. */}
                  <span className="sr-only">{item.label}</span>
                </Link>
                {/* Flyout to the right of the rail: the label, plus sub-links
                    the icon alone could not reach. `pl-2` is a hoverable bridge
                    so the pointer can cross from icon to panel, and the hide
                    waits 250ms so a diagonal path to a lower link doesn't drop
                    it. The open one stacks over one still fading out. */}
                <div className="invisible absolute left-full top-0 z-[9999] pl-2 opacity-0 transition-[opacity,visibility] delay-250 duration-100 group-focus-within:visible group-focus-within:z-[10000] group-focus-within:opacity-100 group-focus-within:delay-0 group-hover:visible group-hover:z-[10000] group-hover:opacity-100 group-hover:delay-0">
                  <div className="min-w-44 rounded-md border border-line bg-surface p-1 shadow-lg">
                    <p className="px-2 py-1 text-xs font-semibold text-fg-subtle">{item.label}</p>
                    {links.length > 0 && subLinkList(links, "space-y-1")}
                  </div>
                </div>
              </li>
            );
          }

          if (links.length === 0) {
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onLinkClick}
                  aria-current={active ? "page" : undefined}
                  className={`${LINK_BASE} ${active ? LINK_ACTIVE : LINK_IDLE}`}
                >
                  {item.icon && <NavIcon name={item.icon} className="size-5 shrink-0" />}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href}>
              {/* Dimmed so the links under it lead; a touch brighter while it holds the current page. */}
              <p className={`${HEADING_CLASS} ${activeChild ? "text-fg-subtle" : "text-fg-faint"}`}>
                {item.icon && <NavIcon name={item.icon} className="size-3 shrink-0" />}
                {item.label}
              </p>
              {subLinkList(links, "ml-3 space-y-1")}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
