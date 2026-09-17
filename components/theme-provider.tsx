"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

/*
 * Owns the one bit of state the theme needs: light or dark. Applying it is a
 * single class on <html>, which re-points every token in app/globals.css — no
 * component re-renders to change color.
 *
 * There is no "system" mode. The OS preference only decides what a visitor who
 * has never chosen sees first; the moment they use the toggle, that choice is
 * stored and outranks the OS from then on.
 *
 * The first paint is handled by THEME_SCRIPT below, inlined in <head> so the
 * class is on <html> before the browser paints. This provider only takes over
 * afterwards, for the toggle.
 */

export type Theme = "light" | "dark";

/** Shared with THEME_SCRIPT; changing it invalidates everyone's saved choice. */
const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs synchronously while <head> is parsed, before the first paint. Kept in
 * sync with `initialTheme()` by hand — it cannot import anything.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

/** The stored choice, or the OS preference for a visitor who has none. */
function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); falling back
    // to the OS preference is fine.
  }
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Starts light so the server and the first client render agree; the real
  // value is read in the layout effect below, before paint.
  const [theme, setThemeState] = useState<Theme>("light");

  useLayoutEffect(() => {
    setThemeState(initialTheme());
  }, []);

  // Before paint, so switching never shows a frame of the old theme. This also
  // restores the class after React's dev-only remount, which resets <html> to
  // the attributes it manages from JSX and drops the one the inline script set.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice just will not survive the session.
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
