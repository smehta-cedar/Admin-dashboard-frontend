/*
 * The fake sign-in session: a plain cookie holding the signed-in user's ID.
 * Client-safe (no server-only import): the login form writes the cookie and
 * Sign out clears it, both from the browser; the dashboard layout reads it on
 * the server (lib/session.ts) to find the user.
 *
 * Placeholder until Supabase Auth: the cookie is neither HttpOnly nor signed,
 * so anyone can set it to any user ID. It only decides who the app shows as
 * signed in; nothing is protected by it.
 */

import type { UserRecord } from "@/lib/users";

export const SESSION_COOKIE = "mc-fake-session";

/** Thirty days, so a dev session survives a restart. */
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** What the shell knows about the signed-in user. Never the password. */
export type SessionUser = Pick<UserRecord, "id" | "name" | "email" | "role">;

/** Writes the session cookie for `userId` (browser only). */
export function setSessionCookie(userId: string) {
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(userId)}; path=/; max-age=${SESSION_MAX_AGE}; samesite=lax`;
}

/** Removes the session cookie (browser only). */
export function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
