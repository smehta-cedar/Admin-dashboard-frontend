import "server-only";

/*
 * Data boundary for commission-view.
 *
 * This is the only module that knows where commission data comes from. Today
 * it returns fake data; next it queries Supabase; later it gets swapped for
 * the main system's API. Everything else imports the types and functions
 * exported here and nothing below them.
 *
 * Amounts stay decimal strings end to end. The source groups by agent and
 * carrier; row, column, and grand totals are summed here with exact BigInt
 * arithmetic. When this moves to Supabase, cast in SQL (e.g.
 * `sum(amount)::text`): PostgREST serializes numeric as a JSON number, which
 * JSON.parse turns into a float before we ever see it.
 */

/** Exact decimal amount as a string, e.g. "1250.00" or "-120.00". Never parse to a JS number. */
export type Money = string;

/** Calendar month as "YYYY-MM", regardless of how the source stores it. */
export type Month = string;

export type CarrierCode = string;

export type Carrier = {
  code: CarrierCode;
  name: string;
};

export type Agent = {
  id: string;
  name: string;
};

export type CommissionMatrix = {
  month: Month;
  /**
   * Columns: the requested carriers in getCarriers() order, including ones
   * with no data this month (usually a statement that never arrived).
   */
  carriers: Carrier[];
  /**
   * One row per agent with data for these carriers this month, sorted by name.
   * Rows with no assigned agent are collected into a single row with
   * `agent: null`, always last.
   */
  rows: MatrixRow[];
  /** Column totals. A missing key means no data for that carrier this month. */
  carrierTotals: Partial<Record<CarrierCode, Money>>;
  /** Null when there is no data at all for this month and these carriers. */
  grandTotal: Money | null;
};

export type MatrixRow = {
  /** Null is the unassigned bucket, not an error. */
  agent: Agent | null;
  /**
   * Summed amount per carrier. A missing key means no rows for that carrier,
   * which is different from "0.00" (rows that net to zero).
   */
  cells: Partial<Record<CarrierCode, Money>>;
  total: Money;
};

/** Every carrier in the dimension table, sorted by name. */
export async function getCarriers(): Promise<Carrier[]> {
  return FAKE_CARRIERS.slice();
}

/**
 * Builds the agent × carrier matrix for a month. Omit `carrierCodes` for all
 * carriers; an empty array means no columns. Unknown codes throw — validate
 * URL params against getCarriers() first.
 */
export async function getMatrix(
  month: Month,
  carrierCodes?: CarrierCode[],
): Promise<CommissionMatrix> {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error(`Invalid month "${month}", expected YYYY-MM`);
  }

  const allCarriers = await getCarriers();
  if (carrierCodes) {
    const unknown = carrierCodes.filter(
      (code) => !allCarriers.some((carrier) => carrier.code === code),
    );
    if (unknown.length > 0) {
      throw new Error(`Unknown carrier codes: ${unknown.join(", ")}`);
    }
  }
  const carriers = carrierCodes
    ? allCarriers.filter((carrier) => carrierCodes.includes(carrier.code))
    : allCarriers;

  const aggregates = await fetchAggregates(
    month,
    carriers.map((carrier) => carrier.code),
  );
  return buildMatrix(month, carriers, aggregates);
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** One source row per (agent, carrier) for the month — what the real query will return. */
type AggregateRow = {
  agent: Agent | null;
  carrierCode: CarrierCode;
  amount: Money;
};

async function fetchAggregates(
  _month: Month,
  carrierCodes: CarrierCode[],
): Promise<AggregateRow[]> {
  return FAKE_AGGREGATES.filter((row) => carrierCodes.includes(row.carrierCode));
}

function buildMatrix(
  month: Month,
  carriers: Carrier[],
  aggregates: AggregateRow[],
): CommissionMatrix {
  const rowsByAgentId = new Map<string | null, MatrixRow>();
  const carrierTotals: Partial<Record<CarrierCode, Money>> = {};
  let grandTotal: Money | null = null;

  for (const { agent, carrierCode, amount } of aggregates) {
    const agentId = agent === null ? null : agent.id;
    let row = rowsByAgentId.get(agentId);
    if (!row) {
      row = { agent, cells: {}, total: "0" };
      rowsByAgentId.set(agentId, row);
    }

    row.cells[carrierCode] = addMoney(row.cells[carrierCode] ?? "0", amount);
    row.total = addMoney(row.total, amount);
    carrierTotals[carrierCode] = addMoney(carrierTotals[carrierCode] ?? "0", amount);
    grandTotal = addMoney(grandTotal ?? "0", amount);
  }

  const rows = [...rowsByAgentId.values()].sort(compareRows);
  return { month, carriers, rows, carrierTotals, grandTotal };
}

function compareRows(a: MatrixRow, b: MatrixRow): number {
  if (a.agent === null) return b.agent === null ? 0 : 1;
  if (b.agent === null) return -1;
  return a.agent.name.localeCompare(b.agent.name) || a.agent.id.localeCompare(b.agent.id);
}

/** Exact decimal addition; the result keeps the larger scale, like Postgres numeric. */
function addMoney(a: Money, b: Money): Money {
  const scale = Math.max(scaleOf(a), scaleOf(b));
  return fromScaled(toScaled(a, scale) + toScaled(b, scale), scale);
}

function scaleOf(value: Money): number {
  const point = value.indexOf(".");
  return point === -1 ? 0 : value.length - point - 1;
}

function toScaled(value: Money, scale: number): bigint {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const scaled = BigInt(whole + fraction.padEnd(scale, "0"));
  return negative ? -scaled : scaled;
}

function fromScaled(scaled: bigint, scale: number): Money {
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(scale + 1, "0");
  const whole = scale === 0 ? digits : digits.slice(0, -scale);
  const fraction = scale === 0 ? "" : `.${digits.slice(-scale)}`;
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

// Fake data. Mirrors today's reality: no agent assignment yet, so every row is
// unassigned. DEVOTED has no data (missing statement); ANTHEM nets to zero.
const FAKE_CARRIERS: Carrier[] = [
  { code: "AETNA", name: "Aetna" },
  { code: "ANTHEM", name: "Anthem" },
  { code: "DEVOTED", name: "Devoted Health" },
  { code: "HUMANA", name: "Humana" },
  { code: "UHC", name: "UnitedHealthcare" },
  { code: "WELLCARE", name: "Wellcare" },
];

const FAKE_AGGREGATES: AggregateRow[] = [
  { agent: null, carrierCode: "AETNA", amount: "1865.75" },
  { agent: null, carrierCode: "ANTHEM", amount: "0.00" },
  { agent: null, carrierCode: "HUMANA", amount: "2417.75" },
  { agent: null, carrierCode: "UHC", amount: "2230.00" },
  { agent: null, carrierCode: "WELLCARE", amount: "388.10" },
];
