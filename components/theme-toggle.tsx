"use client";

import { useTheme } from "./theme-provider";

/*
 * One control for the whole app: light ↔ dark. The icon shows the theme the
 * press would switch *to*, so it always agrees with the label.
 */

const SUN = "M10 3.5v1.5m0 10v1.5m6.5-6.5H15M5 10H3.5m11-4.6-1 1M6.5 13.5l-1 1m9 0-1-1M6.5 6.5l-1-1M13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z";
/** Crescent: the moon's own edge, then the bite taken out of it. */
const MOON = "M16 11.7A6.5 6.5 0 1 1 8.3 4a5.5 5.5 0 0 0 7.7 7.7Z";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const next = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${next} theme`;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
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
        <path d={next === "dark" ? MOON : SUN} />
      </svg>
    </button>
  );
}
