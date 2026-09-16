import Link from "next/link";
import { usePathname } from "next/navigation";

/*
 * Client-only: reads the pathname to mark the active link. Rendered by
 * AppShell, which is the client boundary, so it has no directive of its own.
 */

export type NavItem = {
  href: string;
  label: string;
  /** Sub-links rendered indented under this item. */
  children?: NavItem[];
};

type SidebarProps = {
  items: NavItem[];
  /** Called when any link is clicked, e.g. to close the mobile drawer. */
  onLinkClick?: () => void;
};

/** "/" matches only itself; other items also match their nested routes. */
function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const LINK_BASE = "block rounded-md px-3 py-2 text-sm font-medium";
const LINK_ACTIVE = "bg-gray-100 text-gray-900";
const LINK_IDLE = "text-gray-600 hover:bg-gray-50 hover:text-gray-900";

export function Sidebar({ items, onLinkClick }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="px-3 py-4">
      <ul className="space-y-1">
        {items.map((item) => {
          const children = item.children ?? [];
          const activeChild = children.some((child) =>
            isActive(pathname, child.href),
          );
          // With children, only an exact match marks the parent as the
          // current page; a matching child gets aria-current instead and the
          // parent is shown in a muted selected state.
          const active = children.length
            ? pathname === item.href
            : isActive(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onLinkClick}
                aria-current={active ? "page" : undefined}
                className={`${LINK_BASE} ${
                  active
                    ? LINK_ACTIVE
                    : activeChild
                      ? "text-gray-900 hover:bg-gray-50"
                      : LINK_IDLE
                }`}
              >
                {item.label}
              </Link>
              {children.length > 0 && (
                <ul className="mt-1 ml-3 space-y-1">
                  {children.map((child) => {
                    const childActive = isActive(pathname, child.href);
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
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
