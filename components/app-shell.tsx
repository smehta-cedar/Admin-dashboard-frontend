"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/fake-session";
import { BrandLogo } from "./brand-logo";
import { Navbar } from "./navbar";
import { Sidebar, type NavItem } from "./sidebar";

/*
 * Page frame: sticky navbar on top, a nav rail on the left from `lg` up, and
 * below `lg` the same nav in a drawer. The drawer is a native modal <dialog>,
 * which gives us focus trapping, Escape to close, an inert background, and
 * focus restored to the menu button on close.
 *
 * Footer items (e.g. Agency) pin to the bottom of the rail and the drawer.
 */

/** Tailwind's `lg` breakpoint. */
const DESKTOP_QUERY = "(min-width: 64rem)";
/** Remembers the rail's collapsed state across visits. */
const COLLAPSED_KEY = "sidebar-collapsed";

type AppShellProps = {
  navItems: NavItem[];
  /** Pinned to the bottom of the rail and drawer, e.g. Agency. */
  footerItems?: NavItem[];
  /** The signed-in user, shown in the navbar. */
  user: SessionUser;
  children: ReactNode;
};

export function AppShell({ navItems, footerItems = [], user, children }: AppShellProps) {
  const drawerRef = useRef<HTMLDialogElement>(null);
  const drawerId = useId();
  const railId = useId();
  const pathname = usePathname();
  // Starts expanded so the server and first client render agree; the stored
  // preference is applied right after mount.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "true");
    } catch {
      // Storage can be unavailable (private mode, blocked cookies); the
      // default expanded rail is a fine fallback.
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // Preference just will not survive the session.
      }
      return next;
    });
  };

  const openDrawer = () => drawerRef.current?.showModal();
  const closeDrawer = () => drawerRef.current?.close();

  // Link clicks close the drawer right away; this also covers back/forward.
  useEffect(() => {
    drawerRef.current?.close();
  }, [pathname]);

  // An open modal dialog keeps the page inert even while `lg:hidden` hides it,
  // so close it if the viewport widens past the breakpoint.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) drawerRef.current?.close();
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>

      <Navbar
        onMenuClick={openDrawer}
        drawerId={drawerId}
        railCollapsed={collapsed}
        onToggleRail={toggleCollapsed}
        railId={railId}
        user={user}
      />

      <div className="lg:flex">
        <aside
          id={railId}
          className={`hidden lg:sticky lg:top-14 lg:flex lg:h-[calc(100dvh-3.5rem)] lg:shrink-0 lg:flex-col lg:border-r lg:border-line lg:bg-surface-muted lg:transition-[width] ${
            // Collapsed, the rail must not clip its own hover flyouts, so it
            // trades scrolling for overflow — six icons fit any viewport.
            collapsed ? "lg:w-16 lg:overflow-visible" : "lg:w-60 lg:overflow-y-auto"
          }`}
        >
          <div className={collapsed ? "overflow-visible" : "min-h-0 flex-1 overflow-y-auto"}>
            <Sidebar items={navItems} collapseChildren collapsed={collapsed} />
          </div>
          {footerItems.length > 0 ? (
            <div
              className={`mt-auto shrink-0 border-t border-line ${
                collapsed ? "overflow-visible" : ""
              }`}
            >
              <Sidebar items={footerItems} collapseChildren collapsed={collapsed} />
            </div>
          ) : null}
        </aside>
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <dialog
        id={drawerId}
        ref={drawerRef}
        aria-label="Navigation"
        // The inner panel fills the dialog, so only backdrop clicks land here.
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
        className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-surface shadow-xl backdrop:bg-scrim lg:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
            <div aria-hidden="true" className="bg-brand-gradient absolute inset-x-0 top-0 h-0.5" />
            <div className="flex items-center gap-3">
              <BrandLogo height={30} />
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation"
              className="-mr-2 rounded-md p-2 text-fg-muted hover:bg-surface-hover hover:text-fg"
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
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-muted">
            <div className="flex-1">
              <Sidebar items={navItems} onLinkClick={closeDrawer} />
            </div>
            {footerItems.length > 0 ? (
              <div className="mt-auto border-t border-line">
                <Sidebar items={footerItems} onLinkClick={closeDrawer} />
              </div>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
