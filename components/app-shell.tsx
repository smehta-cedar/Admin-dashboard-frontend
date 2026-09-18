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
 */

/** Tailwind's `lg` breakpoint. */
const DESKTOP_QUERY = "(min-width: 64rem)";
/** Remembers the rail's collapsed state across visits. */
const COLLAPSED_KEY = "sidebar-collapsed";

type AppShellProps = {
  title: string;
  navItems: NavItem[];
  /** The signed-in user, shown in the navbar. */
  user: SessionUser;
  children: ReactNode;
};

export function AppShell({ title, navItems, user, children }: AppShellProps) {
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
        title={title}
        onMenuClick={openDrawer}
        drawerId={drawerId}
        railCollapsed={collapsed}
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
          {/* Padding matches the Sidebar's own so the hamburger lands on the
              same x as the nav icons under it. */}
          <div className={`shrink-0 pt-4 ${collapsed ? "px-2" : "px-3"}`}>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-controls={railId}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`flex w-full items-center rounded-md py-2 text-fg-subtle hover:bg-brand-soft/60 hover:text-fg ${
                collapsed ? "justify-center px-0" : "px-3"
              }`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="size-5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              >
                <path d="M3 5h14M3 10h14M3 15h14" />
              </svg>
            </button>
          </div>
          <div className={collapsed ? "overflow-visible" : "flex-1 overflow-y-auto"}>
            <Sidebar items={navItems} collapseChildren collapsed={collapsed} />
          </div>
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
              <span className="sr-only">{title}</span>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation"
              className="-mr-2 rounded-md p-2 text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-surface-muted">
            <Sidebar items={navItems} onLinkClick={closeDrawer} />
          </div>
        </div>
      </dialog>
    </>
  );
}
