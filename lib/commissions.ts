import "server-only";

/*
 * Data boundary for commission-view.
 *
 * This is the only module that knows where commission data comes from. Today
 * it returns fake data; next it queries Supabase; later it gets swapped for
 * the main system's API. Everything else imports the types and functions
 * exported here and nothing below them.
 *
 * Amounts stay decimal strings end to end. When this moves to Supabase, cast
 * in SQL (e.g. `sum(amount)::text`): PostgREST serializes numeric as a JSON
 * number, which JSON.parse turns into a float before we ever see it.
 */

/** Exact decimal amount as a string, e.g. "1250.00" or "-120.00". Never parse to a JS number. */
export type Money = string;

/** Calendar month as "YYYY-MM". */
export type Month = string;

export type CarrierCode = string;

export type CommissionMatrix = {
  month: Month;
  /** Column order: every carrier with at least one row this month, sorted by code. */
  carriers: CarrierCode[];
  /** Row order: every agent with at least one row this month, sorted by agent. */
  rows: MatrixRow[];
  /** Column totals across all agents. Has a key for every entry in `carriers`. */
  carrierTotals: Record<CarrierCode, Money>;
  grandTotal: Money;
};

export type MatrixRow = {
  agent: string;
  /**
   * Summed amount per carrier. A missing key means the agent has no rows for
   * that carrier this month, which is different from "0.00" (rows that net to zero).
   */
  cells: Partial<Record<CarrierCode, Money>>;
  /** Row total across this agent's cells. */
  total: Money;
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function getMatrix(month: Month): Promise<CommissionMatrix> {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error(`Invalid month "${month}", expected YYYY-MM`);
  }

  // Fake data. Totals are hand-summed so they reconcile like real ones will.
  return {
    month,
    carriers: ["AETNA", "HUMANA", "UHC", "WELLCARE"],
    rows: [
      {
        agent: "Alvarez, Maria",
        cells: { AETNA: "1250.00", HUMANA: "842.50", UHC: "310.00" },
        total: "2402.50",
      },
      {
        agent: "Chen, David",
        cells: { HUMANA: "1575.25", UHC: "-120.00", WELLCARE: "0.00" },
        total: "1455.25",
      },
      {
        agent: "Okafor, Grace",
        cells: { AETNA: "615.75", UHC: "2040.00", WELLCARE: "388.10" },
        total: "3043.85",
      },
    ],
    carrierTotals: {
      AETNA: "1865.75",
      HUMANA: "2417.75",
      UHC: "2230.00",
      WELLCARE: "388.10",
    },
    grandTotal: "6901.60",
  };
}
