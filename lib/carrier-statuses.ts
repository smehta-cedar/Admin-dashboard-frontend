/*
 * Where the agency stands with a carrier. Plain constants, safe to import
 * from client components (lib/carriers.ts is server-only). Only "active" is
 * in force: the API's is_active is true for it alone.
 */

/** Form order; the API's CARRIER_STATUSES. */
export const CARRIER_STATUSES = ["active", "applied", "pending", "expired", "inactive"] as const;

export type CarrierStatus = (typeof CARRIER_STATUSES)[number];

/**
 * The API's status as the app holds it. A status the app doesn't know falls
 * back to is_active ("active" / "inactive") with a console warning.
 */
export function toCarrierStatus(status: string | undefined, isActive: boolean, name: string): CarrierStatus {
  if ((CARRIER_STATUSES as readonly string[]).includes(status ?? "")) return status as CarrierStatus;
  console.warn(`Carrier ${name} has status ${JSON.stringify(status)}; reading it from is_active.`);
  return isActive ? "active" : "inactive";
}
