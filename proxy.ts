import { NextResponse, type NextRequest } from "next/server";
import { apiRequest, type TokenPair } from "@/lib/api";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "@/lib/auth-cookies";
import { jwtExpiresWithin } from "@/lib/jwt";

/*
 * Keeps the session alive. Runs before every page and server action: when
 * the access cookie is missing or about to expire and a refresh cookie is
 * present, it calls POST /auth/refresh/ and stores the new pair, both on the
 * response (for the browser) and on the forwarded request (so this render's
 * cookies() already sees the new access token).
 *
 * The backend rotates refresh tokens and blacklists the old one, so a refresh
 * token is good for exactly one refresh. A browser fires several requests at
 * once (a navigation plus its prefetches), each carrying the same old
 * refresh token; only the first may hit the API. `rotations` dedupes them:
 * every request with the same old token awaits the same promise, and the
 * result is kept for a minute for a straggler that left before the browser
 * stored the new cookies.
 *
 * Refresh failures: a definite rejection (401) clears both cookies so the
 * dashboard gate sends the visitor to sign in; a network failure leaves them
 * alone and lets the page decide.
 *
 * Nothing here decides who may see what; the dashboard layout does that with
 * getSessionUser(). This only makes sure the token it reads is fresh.
 */

/** Refresh when the access token has less than this left, so a render never straddles its expiry. */
const REFRESH_AHEAD_MS = 60 * 1000;
/** How long a finished rotation stays answerable for late requests carrying the old token. */
const ROTATION_TTL_MS = 60 * 1000;

type Rotation = { ok: true; tokens: TokenPair } | { ok: false; definite: boolean };

const rotations = new Map<string, Promise<Rotation>>();

function rotate(refresh: string): Promise<Rotation> {
  const pending = rotations.get(refresh);
  if (pending) return pending;

  const promise = apiRequest<TokenPair>("/auth/refresh/", { method: "POST", body: { refresh } }).then(
    (result): Rotation => {
      if (result.ok) return { ok: true, tokens: result.data };
      // 401 = the API refused the token (expired, blacklisted, user gone). Anything else is not its verdict.
      return { ok: false, definite: result.status === 401 };
    },
  );
  rotations.set(refresh, promise);
  setTimeout(() => rotations.delete(refresh), ROTATION_TTL_MS);
  return promise;
}

export async function proxy(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  const fresh = access !== undefined && !jwtExpiresWithin(access, REFRESH_AHEAD_MS);
  if (fresh || !refresh) return NextResponse.next();

  const rotation = await rotate(refresh);

  if (rotation.ok) {
    // The forwarded request carries the new cookies, so cookies() downstream reads them.
    request.cookies.set(ACCESS_COOKIE, rotation.tokens.access);
    request.cookies.set(REFRESH_COOKIE, rotation.tokens.refresh);
    const response = NextResponse.next({ request });
    setAuthCookies(response.cookies, rotation.tokens);
    return response;
  }

  if (rotation.definite) {
    request.cookies.delete(ACCESS_COOKIE);
    request.cookies.delete(REFRESH_COOKIE);
    const response = NextResponse.next({ request });
    clearAuthCookies(response.cookies);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Pages and server actions only: static assets and files with an extension never need a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
