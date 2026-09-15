import Link from "next/link";
import { usePathname } from "next/navigation";

/*
 * Client-only: reads the pathname to mark the active link. Rendered by
 * AppShell, which is the client boundary, so it has no directive of its own.
 */

export type NavItem = {
  href: string;
  label: string;
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

export function Sidebar({ items, onLinkClick }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="px-3 py-4">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onLinkClick}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
