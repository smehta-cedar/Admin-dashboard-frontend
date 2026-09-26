import "server-only";

/*
 * Who is signed in, resolved on the server from the access-token cookie and
 * GET /auth/me/. The dashboard layout calls this to gate the app and to name
 * the user in the navbar; the landing and login pages call it to bounce a
 * signed-in visitor to /overview.
 *
 * By the time a page renders, the proxy (proxy.ts) has already swapped an
 * expiring access token for a fresh pair, so a plain read is enough here. A
 * server component can't write cookies, so a token the API still rejects
 * (revoked after a password change, a blocked account) just reads as signed
 * out; the next login overwrites the cookies.
 *
 * Wrapped in React's cache() so a layout and its page (the profile page reads
 * the full record through getApiUser) share one API call per request. Reading cookies() makes every caller render per request, which a
 * session needs anyway.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { apiRequest } from "@/lib/api";
import { ACCESS_COOKIE } from "@/lib/auth-cookies";
import { toSessionUser, type ApiUser, type SessionUser } from "@/lib/auth-user";

export type { SessionUser } from "@/lib/auth-user";

/** The signed-in user exactly as the API serialises them; the profile page shows all of it. */
export const getApiUser = cache(async (): Promise<ApiUser | null> => {
  const cookieStore = await cookies();
  const access = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!access) return null;

  const result = await apiRequest<ApiUser>("/auth/me/", { token: access });
  // 401: the token is stale or revoked. Anything else (the API is down) is
  // also "not signed in" for this render rather than a crash.
  if (!result.ok) return null;
  return result.data;
});

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const user = await getApiUser();
  return user ? toSessionUser(user) : null;
});
