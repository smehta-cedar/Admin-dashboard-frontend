import "server-only";

/*
 * Data boundary for HR requests. Today it reads fake requests from
 * data/requests.json, plus the tee orders the public shop appends to
 * data/merch-requests.json (lib/merch-requests.ts); later it queries
 * Supabase. The JSON is trusted as-is, except that a missing or unknown
 * status loads as "pending" with a console.warn.
 *
 * A request is one agent asking for one thing: a licence in a state with a
 * carrier, a contract with a carrier in a state, or days off. Every request
 * starts pending; HR sets it approved or denied on the HR page. The
 * Create-a-request button in the navbar files one from anywhere, so the list
 * is held in a client provider
 * on the dashboard layout (components/requests-store.tsx). Labels, the
 * status list and the pure save are client-safe in lib/request-options.ts.
 *
 * A merch request is the one kind not tied to an agent: a visitor ordering
 * the Cedar Grove tee at /shop. It carries the buyer's own contact details
 * instead of an agentId, and is filed by a server action, not the dialog.
 */

import requestsJson from "@/data/requests.json";
import { readMerchRequests } from "@/lib/merch-requests";

export type RequestType = "licensing" | "contract" | "dayOff" | "merch";

/** The types the Create-a-request dialog files: every one names an agent. */
export type AgentRequestType = Exclude<RequestType, "merch">;

export type RequestStatus = "pending" | "approved" | "denied";

type RequestBase = {
  /** Internal ID, numbered 1, 2, 3, … across both JSON files. */
  id: string;
  /** Defaults to "pending" when filed. */
  status: RequestStatus;
  /** ISO 8601 timestamp in UTC, when it was filed. */
  createdAt: string;
  /** Free text from whoever filed it. */
  note?: string;
};

export type AgentRequestRecord = RequestBase & {
  /** The agent the request is for. */
  agentId: string;
} & (
    /** State code from lib/us-states.ts, and the carrier the licence or contract is with. */
    | { type: "licensing"; state: string; carrierId: string }
    | { type: "contract"; state: string; carrierId: string }
    | {
        type: "dayOff";
        /** "YYYY-MM-DD", inclusive. */
        startDate: string;
        /** "YYYY-MM-DD", inclusive, on or after startDate. */
        endDate: string;
      }
  );

/** A tee order from the public shop. Options and labels live in lib/shop.ts. */
export type MerchRequestRecord = RequestBase & {
  type: "merch";
  buyerName: string;
  email: string;
  /** In the one display format (lib/phone.ts). */
  phone: string;
  /** Shipping address as typed, may span lines. */
  address: string;
  size: string;
  color: string;
  quantity: number;
};

export type RequestRecord = AgentRequestRecord | MerchRequestRecord;

const STATUSES: readonly string[] = ["pending", "approved", "denied"] satisfies RequestStatus[];

/** Every request from both files, in ID order (1, 2, 3, …). */
export async function getRequests(): Promise<RequestRecord[]> {
  const merch = await readMerchRequests();
  return [...(requestsJson as RequestRecord[]), ...merch]
    .map((request) => {
      if (STATUSES.includes(request.status)) return request;
      console.warn(`Request ${request.id} has status "${request.status}"; reading it as pending.`);
      return { ...request, status: "pending" as const };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}
