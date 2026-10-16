import type { CarrierRecord } from "@/lib/carriers";
import { LINES_OF_BUSINESS, type LineOfBusiness } from "@/lib/lines-of-business";

/*
 * What the certification forms offer: carriers, each with the lines that
 * need a certification (the certification's sub type). A plain module, not
 * a server-only or client one, so pages can build the options on the server
 * and the client forms can use them too.
 */

/** A carrier as a certification form offers it. */
export type CertifiableCarrier = {
  id: string;
  name: string;
  status: "active" | "inactive";
  linesOfBusiness: LineOfBusiness[];
};

/** `carrier` as a certification form offers it. */
export function certifiableCarrier(carrier: CarrierRecord): CertifiableCarrier {
  return {
    id: carrier.id,
    name: carrier.name,
    status: carrier.status === "active" ? "active" : "inactive",
    linesOfBusiness: carrier.certificationLines,
  };
}

/**
 * The lines a form offers for `carrierId`: the lines that carrier marks as
 * needing a certification, or every line when no carrier is chosen.
 * `current` (the row's stored line) is kept on offer even when it is not.
 */
export function linesFor(carriers: CertifiableCarrier[], carrierId: string, current = ""): string[] {
  const carrier = carriers.find((option) => option.id === carrierId);
  const lines: string[] = carrier ? [...carrier.linesOfBusiness] : [...LINES_OF_BUSINESS];
  if (current && !lines.includes(current)) lines.push(current);
  return lines;
}
