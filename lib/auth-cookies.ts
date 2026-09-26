/*
 * Where the tokens live: two HttpOnly cookies that only the Next server can
 * read. Page scripts cannot see them (HttpOnly), they travel over HTTPS only
 * in production (Secure), and SameSite=Lax keeps them off cross-site POSTs.
 *
 * Each cookie expires with its token (the JWT's exp claim), so a token is
 * never sent after the backend would reject it anyway. Access tokens last 30
 * minutes and refresh tokens 7 days; the proxy (proxy.ts) swaps an expiring
 * access token for a new pair before a page renders.
 *
 * The helpers take a "sink" so the same code writes to both `cookies()` in a
 * server action and `response.cookies` in the proxy.
 */

import type { TokenPair } from "@/lib/api";
import { jwtExpiresAt } from "@/lib/jwt";

export const ACCESS_COOKIE = "cg-access";
export const REFRESH_COOKIE = "cg-refresh";

type AuthCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

/** Anything with a `set(name, value, options)`: `await cookies()` or `response.cookies`. */
export type CookieSink = {
  set(name: string, value: string, options: AuthCookieOptions): unknown;
};

/** Fallbacks when a token's exp can't be read; match the backend's lifetimes. */
const ACCESS_FALLBACK_SECONDS = 30 * 60;
const REFRESH_FALLBACK_SECONDS = 7 * 24 * 60 * 60;

function cookieOptions(maxAge: number): AuthCookieOptions {
  return {
    httpOnly: true,
    // Local dev is plain http://localhost; a Secure cookie would never be sent there.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

/** Seconds until the token's exp, or the fallback; at least 1 so the cookie is set at all. */
function secondsUntilExpiry(token: string, fallback: number): number {
  const expiresAt = jwtExpiresAt(token);
  if (expiresAt === null) return fallback;
  return Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));
}

/** Stores a freshly issued pair. */
export function setAuthCookies(sink: CookieSink, tokens: TokenPair) {
  sink.set(ACCESS_COOKIE, tokens.access, cookieOptions(secondsUntilExpiry(tokens.access, ACCESS_FALLBACK_SECONDS)));
  sink.set(
    REFRESH_COOKIE,
    tokens.refresh,
    cookieOptions(secondsUntilExpiry(tokens.refresh, REFRESH_FALLBACK_SECONDS)),
  );
}

/** Removes both cookies (same attributes, max-age 0, so the browser matches them). */
export function clearAuthCookies(sink: CookieSink) {
  sink.set(ACCESS_COOKIE, "", cookieOptions(0));
  sink.set(REFRESH_COOKIE, "", cookieOptions(0));
}
