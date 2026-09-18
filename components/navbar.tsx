"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { clearSessionCookie, initials, type SessionUser } from "@/lib/fake-session";
import { BrandLogo } from "./brand-logo";
import { ThemeToggle } from "./theme-toggle";

type NavbarProps = {
  title: string;
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
  /** The signed-in user: avatar opens a menu with name, email and Sign out. */
  user: SessionUser;
};

export function Navbar({
  title,
  onMenuClick,
  drawerId,
  railCollapsed,
  onToggleRail,
  railId,
  user,
}: NavbarProps) {
  return (
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
      {/* From `lg` this cell matches the sidebar's width. Logo and the collapse
          control sit side by side; collapsed, the mark and control share the
          narrow rail. */}
      <div
        className={`flex items-center self-stretch lg:shrink-0 lg:border-r lg:border-line lg:bg-surface-muted lg:transition-[width] ${
          railCollapsed
            ? "lg:w-16 lg:justify-center lg:px-0"
            : "lg:w-60 lg:justify-between lg:gap-1 lg:px-3"
        }`}
      >
        <Link
          href="/"
          className={`flex items-center gap-3 ${
            railCollapsed ? "lg:hidden" : "lg:min-w-0 lg:flex-1 lg:px-3"
          }`}
        >
          <span className="sm:hidden">
            <BrandLogo compact height={32} />
          </span>
          <span className="hidden sm:block lg:hidden">
            <BrandLogo height={34} />
          </span>
          <span className="hidden lg:block">
            <BrandLogo height={34} />
          </span>
          <span className="sr-only">{title}</span>
        </Link>
        {onToggleRail ? (
          <button
            type="button"
            onClick={onToggleRail}
            aria-expanded={!railCollapsed}
            aria-controls={railId}
            aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-md p-2 text-fg-subtle hover:bg-brand-soft/60 hover:text-fg lg:inline-flex lg:shrink-0"
          >
            <HamburgerIcon />
          </button>
        ) : null}
      </div>
      <span
        aria-hidden="true"
        className="hidden text-sm font-semibold tracking-tight text-charcoal sm:block lg:pl-5"
      >
        {title}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <NotificationsButton />
        <UserMenu user={user} />
      </div>
    </header>
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

/** Bell; placeholder until notifications exist. */
function NotificationsButton() {
  return (
    <button
      type="button"
      aria-label="Notifications"
      title="Notifications"
      className="rounded-md p-2 text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
