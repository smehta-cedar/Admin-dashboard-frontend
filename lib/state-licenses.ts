import { nextId } from "@/lib/change-notes";

/*
 * State licences, the part shared by agents and the agency. Pure and
 * client-safe: the server-only modules (lib/agent-state-licenses.ts,
 * lib/agency-state-licenses.ts) add the owner and the JSON, and the dialogs'
 * saves use the helpers here.
 *
 * A licence row is the truth about a producer's licence in one state. The
 * producer records (AgentRecord, AgencyRecord) still carry `licensedStates`
 * and `licenseNumbers`, because Contracts and the profiles read them, but
 * both are *derived* from the rows — on the server when the record loads
 * (licensedStatesOf / licenseNumbersOf) and in a dialog's save after the
 * rows are edited (applyLicenceEdits). Nothing stores them any more.
 *
 * Every row counts as a licensed state, whatever its status: a pending or
 * JIT licence still lists the state, as the old licensedStates did. The
 * licence number is empty until the state issues one.
 */

/**
 * active: licence in force. review: renewal or paperwork under review.
 * pending: applied for, not issued yet. jit: "just in time" — obtained only
 * when a sale there needs it.
 */
export type StateLicenseStatus = "active" | "review" | "pending" | "jit";

export const STATE_LICENSE_STATUSES: readonly string[] = [
  "active",
  "review",
  "pending",
  "jit",
] satisfies StateLicenseStatus[];

export type StateLicense = {
  /** Internal ID, numbered 1, 2, 3, … for now. Not the licence number. */
  id: string;
  /** US state code from lib/us-states.ts. One row per owner + state. */
  state: string;
  /** The number the state issued. Empty while the licence is still pending. */
  licenseNumber: string;
  status: StateLicenseStatus;
  /** YYYY-MM-DD. When the licence was added. */
  startDate: string;
  /** YYYY-MM-DD. When it expires. */
  endDate: string;
};

/** The shape the producer form edits; the rows are updated from it. */
export type LicenceValues = {
  licensedStates: string[];
  licenseNumbers: Record<string, string>;
};

/** How long a new licence runs from its start date, until the form asks for dates. */
const LICENCE_TERM_YEARS = 2;

/** A row's owner's `licensedStates`: unique codes in code order. */
export function licensedStatesOf(rows: StateLicense[]): string[] {
  return [...new Set(rows.map((row) => row.state))].sort();
}

/** A row's owner's `licenseNumbers`: non-blank numbers by state code, in code order. */
export function licenseNumbersOf(rows: StateLicense[]): Record<string, string> {
  return Object.fromEntries(
    rows
      .slice()
      .sort((a, b) => a.state.localeCompare(b.state))
      .flatMap((row) => {
        const number = row.licenseNumber.trim();
        return number ? [[row.state, number]] : [];
      }),
  );
}

/** A local calendar date as YYYY-MM-DD. */
function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

type ApplyInput<T extends StateLicense> = {
  /** Every row, every owner: new IDs must be unique across them all. */
  rows: T[];
  /** Picks the rows being edited (one agent's, or all of them for the agency). */
  isOwn: (row: T) => boolean;
  values: LicenceValues;
  /** Adds the owner to a new row. */
  own: (row: StateLicense) => T;
  /** When the edit is made; new rows start today. Defaults to now. */
  now?: Date;
};

/**
 * The rows after the producer form is saved, pure. A checked state keeps its
 * row, with the number as entered; an unchecked state's row is dropped; a
 * newly checked state gets a new active row starting today and running
 * LICENCE_TERM_YEARS. Other owners' rows and the order are untouched, and
 * new rows go at the end, so the list stays in ID order.
 */
export function applyLicenceEdits<T extends StateLicense>({
  rows,
  isOwn,
  values,
  own,
  now = new Date(),
}: ApplyInput<T>): T[] {
  const checked = new Set(values.licensedStates);
  const numberFor = (state: string) => (values.licenseNumbers[state] ?? "").trim();

  const kept = rows.flatMap((row) => {
    if (!isOwn(row)) return [row];
    if (!checked.has(row.state)) return [];
    const licenseNumber = numberFor(row.state);
    return [licenseNumber === row.licenseNumber ? row : { ...row, licenseNumber }];
  });

  const have = new Set(rows.filter(isOwn).map((row) => row.state));
  const end = new Date(now);
  end.setFullYear(end.getFullYear() + LICENCE_TERM_YEARS);
  // Numbered past every row that came in, so a dropped row's ID isn't reused.
  let id = Number(nextId(rows));
  const next = kept;
  for (const state of values.licensedStates) {
    if (have.has(state)) continue;
    next.push(
      own({
        id: String(id++),
        state,
        licenseNumber: numberFor(state),
        status: "active",
        startDate: isoDate(now),
        endDate: isoDate(end),
      }),
    );
  }
  return next;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2024-01-15" → "Jan 15, 2024", read straight from the string so the server
 * and the browser agree whatever their timezones. Anything else is shown as is.
 */
export function formatLicenceDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${monthName} ${Number(day)}, ${year}` : date;
}
