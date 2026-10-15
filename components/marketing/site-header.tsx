"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/*
 * Marketing-site header from cg-seniorhealth: transparent over the hero,
 * white once scrolled. Mobile drawer uses a checkbox + CSS siblings.
 */

type SiteHeaderProps = {
  /** Highlight a nav item, e.g. "team" | "careers" | "home" */
  current?: "home" | "team" | "careers";
};

export function SiteHeader({ current }: SiteHeaderProps) {
  const pathname = usePathname();
  const toggleId = useId();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const active =
    current ??
    (pathname?.startsWith("/team")
      ? "team"
      : pathname?.startsWith("/careers")
        ? "careers"
        : "home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header
      className={`site-header${scrolled ? " site-header--scrolled" : ""}`}
      role="banner"
    >
      <div className="container max-w-8xl mx-auto px-4">
        <nav className="nav" aria-label="Main navigation">
          <Link href="/" className="nav__logo" aria-label="Cedar Grove — return to home" onClick={close}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/brand/logo-fullclear.png"
              alt="Cedar Grove Senior Health"
              className="nav__logo-img nav__logo-img--top"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/brand/logo.jpg"
              alt=""
              aria-hidden="true"
              className="nav__logo-img nav__logo-img--scrolled"
            />
          </Link>

          <input
            type="checkbox"
            id={toggleId}
            className="nav__checkbox"
            checked={open}
            onChange={(event) => setOpen(event.target.checked)}
            aria-hidden="true"
          />
          <label
            htmlFor={toggleId}
            className="nav__hamburger"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-controls="nav-drawer"
            aria-expanded={open}
          >
            <span className="bar" />
            <span className="bar" />
            <span className="bar" />
          </label>

          <label htmlFor={toggleId} className="nav__backdrop" aria-hidden="true" tabIndex={-1} />

          <div className="nav__drawer" id="nav-drawer">
            <div className="nav__drawer-top">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/brand/logo.jpg"
                alt=""
                className="nav__drawer-logo"
                aria-hidden="true"
              />
              <p className="nav__drawer-tagline">Solutions You Can Count On</p>
            </div>

            <ul className="nav__links" role="list">
              <li>
                <Link
                  href="/"
                  className="nav__link"
                  aria-current={active === "home" ? "page" : undefined}
                  onClick={close}
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/team"
                  className="nav__link"
                  aria-current={active === "team" ? "page" : undefined}
                  onClick={close}
                >
                  Our Team
                </Link>
              </li>
              <li>
                <Link href="/#services" className="nav__link" onClick={close}>
                  Medicare Info
                </Link>
              </li>
              <li>
                <Link
                  href="/careers"
                  className="nav__link"
                  aria-current={active === "careers" ? "page" : undefined}
                  onClick={close}
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/#contact" className="nav__link" onClick={close}>
                  Contact Us
                </Link>
              </li>
              <li>
                <a
                  href="https://event.cedargrovesolutiongroup.com/"
                  className="nav__link nav__link--cta"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                >
                  Webinars
                </a>
              </li>
            </ul>

            <div className="nav__drawer-footer">
              <a href="tel:9852821000" className="nav__phone">
                <svg
                  className="nav__phone-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span className="nav__phone-text">
                  <span className="nav__phone-label">Call us</span>
                  <span className="nav__phone-number">(985) 282-1000</span>
                </span>
              </a>

              <div className="nav__social" aria-label="Social media">
                <a
                  href="https://facebook.com/cedargrovemedins"
                  className="nav__social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                  </svg>
                </a>
                <Link href="/#contact" className="nav__social-link" aria-label="Get in touch" onClick={close}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
