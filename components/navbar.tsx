"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { clearSessionCookie, type SessionUser } from "@/lib/fake-session";
import type { SearchIndex } from "@/lib/search";
import { initials } from "@/lib/text";
import { BrandLogo } from "./brand-logo";
import { NavbarSearch } from "./navbar-search";
import { RequestDialog } from "./request-dialog";
import type { NavItem } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

/** Icon buttons in the right-hand cluster share this look. */
const ICON_BUTTON_CLASS =
  "rounded-md p-2 text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

type NavbarProps = {
  /** Opens the mobile drawer. The button is hidden at `lg` and up. */
  onMenuClick: () => void;
  /** Id of the drawer element, for aria-controls. */
  drawerId: string;
  /** Mirrors the nav rail so the brand cell stays exactly as wide as it. */
  railCollapsed?: boolean;
  /** Collapses or expands the desktop nav rail. Hidden below `lg`. */
  onToggleRail?: () => void;
  /** Id of the desktop rail, for aria-controls on the collapse control. */
  railId?: string;
  /** Name of the page being viewed, shown right after the brand cell. */
  pageTitle?: string;
  /** Sidebar links the search can be narrowed to; the scope select lists them. */
  searchScopes: NavItem[];
  /** Records the search suggests while typing, per scope. */
  searchIndex: SearchIndex;
  /** The signed-in user: avatar opens a menu with name, email and Sign out. */
  user: SessionUser;
};

export function Navbar({
  onMenuClick,
  drawerId,
  railCollapsed,
  onToggleRail,
  railId,
  pageTitle,
  searchScopes,
  searchIndex,
  user,
}: NavbarProps) {
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6 lg:pl-0 lg:pr-8">
        {/* Brand strip; absolute so the bar stays h-14. */}
        <div aria-hidden="true" className="bg-brand-gradient absolute inset-x-0 top-0 h-0.5" />
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          aria-haspopup="dialog"
          aria-controls={drawerId}
          className="-ml-2 rounded-md p-2 text-fg-muted hover:bg-surface-hover hover:text-fg lg:hidden"
        >
          <HamburgerIcon />
        </button>
        {/* From `lg` this cell matches the sidebar's width: the wordmark, or
            just the mark over the collapsed rail. */}
        <div
          className={`flex items-center self-stretch lg:shrink-0 lg:border-r lg:border-line lg:bg-surface-muted lg:transition-[width] ${
            railCollapsed ? "lg:w-16 lg:justify-center lg:px-0" : "lg:w-60 lg:px-3"
          }`}
        >
          <Link
            href="/"
            className={`flex items-center gap-3 ${railCollapsed ? "" : "lg:min-w-0 lg:px-3"}`}
          >
            <span className="sm:hidden">
              <BrandLogo compact height={32} />
            </span>
            <span className="hidden sm:block lg:hidden">
              <BrandLogo height={34} />
            </span>
            <span className="hidden lg:block">
              {railCollapsed ? <BrandLogo compact height={32} /> : <BrandLogo height={34} />}
            </span>
          </Link>
        </div>
        {/* Collapse control, just left of the title. `lg:ml-3` puts the icon on
            the page content's left edge. */}
        {onToggleRail ? (
          <button
            type="button"
            onClick={onToggleRail}
            aria-expanded={!railCollapsed}
            aria-controls={railId}
            aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-md p-2 text-fg-muted hover:bg-surface-hover hover:text-fg lg:ml-3 lg:inline-flex lg:shrink-0"
          >
            <HamburgerIcon />
          </button>
        ) : null}
        {/* Title and the right-hand cluster take equal shares from `md`, which
            keeps the search between them in the middle. Not a heading: the
            page keeps a visually hidden <h1> (PageHeader) for screen readers. */}
        <p className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-fg">{pageTitle}</p>
        {/* From `md`; narrower screens get the row under the bar instead. */}
        <NavbarSearch scopes={searchScopes} index={searchIndex} className="hidden w-64 shrink-0 md:flex lg:w-80" />
        <div className="ml-auto flex items-center justify-end gap-1 md:ml-0 md:flex-1">
          <CreateRequestButton />
          <ThemeToggle />
          <NotificationsButton />
          <UserMenu user={user} />
        </div>
      </header>
      {/* Below `md` the bar has no room, so the search sits in its own row and
          scrolls away with the page. */}
      {searchScopes.length > 0 ? (
        <div className="border-b border-line bg-surface px-4 py-2 sm:px-6 md:hidden">
          <NavbarSearch scopes={searchScopes} index={searchIndex} className="flex w-full" />
        </div>
      ) : null}
    </>
  );
}

function HamburgerIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <path d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  );
}

/**
 * "+" that opens the Create-a-request popup (./request-dialog.tsx) from any
 * page. The request goes into the requests store on the dashboard layout, so
 * it is there when HR is opened next.
 */
function CreateRequestButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="Create a request"
        title="Create a request"
        className={ICON_BUTTON_CLASS}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="M10 4v12M4 10h12" />
        </svg>
      </button>
      <RequestDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Bell; placeholder until notifications exist. */
function NotificationsButton() {
  return (
    <button
      type="button"
      aria-label="Notifications"
      title="Notifications"
      className={ICON_BUTTON_CLASS}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8.5 16.5a1.5 1.5 0 0 0 3 0M4.5 14.5h11l-1.2-1.5V9a4.3 4.3 0 1 0-8.6 0v4Z" />
      </svg>
    </button>
  );
}

/** Avatar that opens a menu with name, email and Sign out. */
function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = () => {
    clearSessionCookie();
    setOpen(false);
    // The login page and the dashboard gate both read the cookie on the
    // server; refresh so no signed-in render is reused.
    router.push("/login");
    router.refresh();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((current) => !current)}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink hover:ring-2 hover:ring-brand-strong/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {initials(user.name)}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-sm font-medium text-fg">{user.name}</p>
            <p className="truncate text-xs text-fg-muted">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="block w-full px-3 py-2 text-left text-sm text-fg-muted hover:bg-surface-hover hover:text-fg"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
