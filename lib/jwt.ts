/*
 * Reads the expiry out of a JWT without verifying it. The frontend never
 * trusts a token's claims for anything but timing: the backend verifies the
 * signature on every request. Client-safe (no imports), used by the proxy
 * and the cookie helpers.
 */

/** The `exp` claim as milliseconds since the epoch, or null when the token can't be read. */
export function jwtExpiresAt(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    // base64url -> base64, padded so atob accepts it.
    const base64 = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const claims: unknown = JSON.parse(atob(base64));
    const exp = (claims as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True when the token has expired or expires within `withinMs` (or can't be read). */
export function jwtExpiresWithin(token: string, withinMs: number): boolean {
  const expiresAt = jwtExpiresAt(token);
  return expiresAt === null || expiresAt - Date.now() < withinMs;
}
