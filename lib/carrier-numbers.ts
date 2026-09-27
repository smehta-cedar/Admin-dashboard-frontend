/*
 * The number a carrier is shown with: its place in the name-sorted list,
 * 1…n. The API's IDs are UUIDs, which only appear in profile URLs. Client-safe
 * (the list view computes it from its live state); lib/carriers.ts is
 * server-only.
 */

import type { CarrierRecord } from "@/lib/carriers";

export type { CarrierRecord } from "@/lib/carriers";

/** Carrier ID -> 1-based position in `carriers` (pass them sorted by name). */
export function carrierNumbers(carriers: readonly CarrierRecord[]): Map<string, number> {
  return new Map(carriers.map((carrier, index) => [carrier.id, index + 1]));
}
