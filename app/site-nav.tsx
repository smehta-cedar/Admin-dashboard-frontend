"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

/*
 * The public homepage's navbar (app/page.tsx). Sticky, on the canvas with a
 * light blur so the gradient bands show through as the page scrolls. Left,
 * the logo back to the top; middle, the page's sections; right, the theme
 * toggle, staff sign-in, and a Call button with the office number.
 *
 * The section link whose section is most in view is marked current, from an
 * IntersectionObserver on the section elements, so the bar doubles as a
 * progress marker. Below `lg` the sections and the sign-in link fold
 * into a panel under the bar; a link click, Escape, or widening the
 * viewport closes it.
 */

export type SiteNavSection = { id: string; label: string };

type SiteNavProps = {
  sections: SiteNavSection[];
  /** As printed, e.g. "985-282-1000"; also used for the tel: link. */
  phone: string;
};

const SECTION_LINK_CLASS =
  "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const SECTION_LINK_IDLE = "text-fg-muted hover:bg-surface-hover hover:text-fg";
const SECTION_LINK_ACTIVE = "bg-brand-soft text-brand-ink";
const CALL_BUTTON_CLASS =
  "inline-flex items-center gap-2 rounded-md bg-brand-strong px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function SiteNav({ sections, phone }: SiteNavProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  // Track which section is most visible. Threshold steps so a tall section
  // still reports as it scrolls through, not only when it first appears.
  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratios.set(entry.target.id, entry.intersectionRatio);
        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        setCurrent(best);
      },
      { rootMargin: "-64px 0px -40% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections]);

  // Escape closes the panel; so does widening past the breakpoint where the
  // links are inline anyway.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const query = window.matchMedia("(min-width: 64rem)");
    const onWiden = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    query.addEventListener("change", onWiden);
    return () => {
      document.removeEventListener("keydown", onKey);
      query.removeEventListener("change", onWiden);
    };
  }, [open]);

  const sectionLinks = (onClick?: () => void, className = "") =>
    sections.map((section) => {
      const active = section.id === current;
      return (
        <a
          key={section.id}
          href={`#${section.id}`}
          onClick={onClick}
          aria-current={active ? "location" : undefined}
          className={`${SECTION_LINK_CLASS} ${active ? SECTION_LINK_ACTIVE : SECTION_LINK_IDLE} ${className}`}
        >
          {section.label}
        </a>
      );
    });

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
      <div className="mx-auto flex h-16 w-full max-w-(--breakpoint-2xl) items-center gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label="Cedar Grove home" className="flex shrink-0 items-center">
          <BrandLogo height={34} />
        </Link>

        {/* Section links: inline from lg. */}
        <nav aria-label="Page sections" className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {sectionLinks()}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-hover hover:text-fg lg:inline-block"
          >
            Log in
          </Link>
          <a href={`tel:${phone}`} className={CALL_BUTTON_CLASS}>
            <PhoneIcon />
            <span className="hidden sm:inline">Call today</span>
            <span className="sr-only sm:not-sr-only sm:font-medium sm:text-white/90"> {phone}</span>
          </a>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Close menu" : "Open menu"}
            className="-mr-2 rounded-md p-2 text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Folded panel below `lg`. Rendered always, hidden when closed, so the
          aria-controls target exists. */}
      <div id={panelId} hidden={!open} className="border-t border-line bg-canvas lg:hidden">
        <nav aria-label="Page sections" className="mx-auto flex max-w-(--breakpoint-2xl) flex-col gap-1 px-4 py-3 sm:px-6 lg:px-10">
          {sectionLinks(() => setOpen(false), "block")}
          <div className="mt-2 flex flex-col gap-1 border-t border-line pt-3">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={`${SECTION_LINK_CLASS} ${SECTION_LINK_IDLE} block`}
            >
              Staff sign in
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 3.5h3l1.5 3.5-2 1.5a9 9 0 0 0 4.5 4.5l1.5-2 3.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5A12.5 12.5 0 0 1 3 5a1.5 1.5 0 0 1 1.5-1.5Z" />
    </svg>
  );
}

function MenuIcon() {
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

function CloseIcon() {
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
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}
