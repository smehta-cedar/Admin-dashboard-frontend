/*
 * Lines of business a carrier is listed under. Plain constants, safe to import
 * from client components (lib/carriers.ts is server-only).
 */

/** Display order. A carrier's lines are stored in this order too. */
export const LINES_OF_BUSINESS = ["General", "Supp/Ancillary", "MAPD", "Life", "Annuities"] as const;

export type LineOfBusiness = (typeof LINES_OF_BUSINESS)[number];
