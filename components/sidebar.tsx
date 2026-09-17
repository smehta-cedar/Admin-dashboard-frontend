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
  /** Leading icon. Top-level items carry one; sub-links are text only. */
  icon?: NavIconName;
  /** Sub-links rendered indented under this item. */
  children?: NavItem[];
};

type SidebarProps = {
  items: NavItem[];
  /** Called when any link is clicked, e.g. to close the mobile drawer. */
  onLinkClick?: () => void;
  /**
   * Collapse sub-links until the item is hovered or holds focus. Off for the
   * touch drawer, where there is no hover and the list has room to stay open.
   */
  collapseChildren?: boolean;
  /** Icons-only rail: labels and sub-links move into a hover flyout. */
  collapsed?: boolean;
};

/** "/" matches only itself; other items also match their nested routes. */
function isActive(pathname: string, href: string, activePrefix?: string) {
  if (activePrefix) return pathname.startsWith(activePrefix);
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const LINK_BASE = "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium";
/* Inset bar on the left edge marks the current page in the logo teal. */
const LINK_ACTIVE = "bg-brand-soft text-brand-ink shadow-[inset_3px_0_0_var(--color-brand)]";
const LINK_IDLE = "text-fg-muted hover:bg-brand-soft/60 hover:text-fg";
/** An ancestor of the current page: selected, but not the page itself. */
const LINK_ANCESTOR = "text-brand-ink hover:bg-brand-soft/60";

/** Caret on the right of an item that has sub-links; points down when open. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`ml-auto size-4 shrink-0 text-fg-faint transition-transform ${
        open ? "rotate-90" : "group-hover:rotate-90 group-focus-within:rotate-90"
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.5 4.5l5 5.5-5 5.5" />
    </svg>
  );
}

export function Sidebar({
  items,
  onLinkClick,
  collapseChildren,
  collapsed,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className={collapsed ? "px-2 py-4" : "px-3 py-4"}>
      <ul className="space-y-1">
        {items.map((item) => {
          const children = item.children ?? [];
          const activeChild = children.some((child) =>
            isActive(pathname, child.href, child.activePrefix),
          );
          // With children, only an exact match marks the parent as the
          // current page; a matching child gets aria-current instead and the
          // parent is shown in a muted selected state.
          const active = children.length
            ? pathname === item.href
            : isActive(pathname, item.href);
          // Hovering (or tabbing into) the item reveals its sub-links, but an
          // item we are already inside stays open so the current page's link
          // does not disappear from under the pointer.
          const pinnedOpen = !collapseChildren || activeChild;
          const parentClass = active
            ? LINK_ACTIVE
            : activeChild
              ? LINK_ANCESTOR
              : LINK_IDLE;

          return (
            <li key={item.href} className="group relative">
              <Link
                href={item.href}
                onClick={onLinkClick}
                aria-current={active ? "page" : undefined}
                className={`${LINK_BASE} ${parentClass} ${
                  collapsed ? "justify-center px-0" : ""
                }`}
              >
                {item.icon && <NavIcon name={item.icon} className="size-5 shrink-0" />}
                {/* Collapsed, the label still names the link for screen
                    readers and the flyout shows it to everyone else. */}
                <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
                {!collapsed && children.length > 0 && <Chevron open={pinnedOpen} />}
              </Link>

              {collapsed ? (
                /* Flyout to the right of the rail: the label, plus sub-links
                   that the icon alone could not reach. `pl-1` keeps the
                   panel's hit area touching the icon so hover survives the
                   gap. */
                <div className="pointer-events-none absolute left-full top-0 z-40 hidden pl-1 group-hover:block group-focus-within:block">
                  <div className="pointer-events-auto min-w-44 rounded-md border border-line bg-surface p-1 shadow-lg">
                    <p className="px-2 py-1 text-xs font-semibold text-fg-subtle">
                      {item.label}
                    </p>
                    {children.length > 0 && (
                      <ul className="space-y-1">
                        {children.map((child) => {
                          const childActive = isActive(
                            pathname,
                            child.href,
                            child.activePrefix,
                          );
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={onLinkClick}
                                aria-current={childActive ? "page" : undefined}
                                className={`${LINK_BASE} ${
                                  childActive ? LINK_ACTIVE : LINK_IDLE
                                }`}
                              >
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                children.length > 0 && (
                  /* Indented so sub-labels line up with the parent's label. */
                  <ul
                    className={`mt-1 ml-[1.875rem] space-y-1 ${
                      pinnedOpen ? "block" : "hidden group-hover:block group-focus-within:block"
                    }`}
                  >
                    {children.map((child) => {
                      const childActive = isActive(pathname, child.href, child.activePrefix);
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={onLinkClick}
                            aria-current={childActive ? "page" : undefined}
                            className={`${LINK_BASE} ${
                              childActive ? LINK_ACTIVE : LINK_IDLE
                            }`}
                          >
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
