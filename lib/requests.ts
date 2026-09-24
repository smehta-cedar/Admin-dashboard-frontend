import "server-only";

/*
 * Data boundary for HR requests. Today it reads fake requests from
 * data/requests.json; later it queries Supabase. The JSON is trusted as-is,
 * except that a missing or unknown status loads as "pending" with a
 * console.warn.
 *
 * A request is one agent asking for one thing: a licence in a state, a
 * contract with a carrier, or days off. Every request starts pending; HR sets
 * it approved or denied on the HR page. The Create-a-request button in the
 * navbar files one from anywhere, so the list is held in a client provider
 * on the dashboard layout (components/requests-store.tsx). Labels, the
 * status list and the pure save are client-safe in lib/request-options.ts.
 */

import requestsJson from "@/data/requests.json";

export type RequestType = "licensing" | "contract" | "dayOff";

export type RequestStatus = "pending" | "approved" | "denied";

type RequestBase = {
  /** Internal ID, numbered 1, 2, 3, … for now. */
  id: string;
  /** The agent the request is for. */
  agentId: string;
  /** Defaults to "pending" when filed. */
  status: RequestStatus;
  /** ISO 8601 timestamp in UTC, when it was filed. */
  createdAt: string;
  /** Free text from whoever filed it. */
  note?: string;
};

export type RequestRecord = RequestBase &
  (
    | { type: "licensing"; /** US state code from lib/us-states.ts. */ state: string }
    | { type: "contract"; carrierId: string }
    | {
        type: "dayOff";
        /** "YYYY-MM-DD", inclusive. */
        startDate: string;
        /** "YYYY-MM-DD", inclusive, on or after startDate. */
        endDate: string;
      }
  );

const STATUSES: readonly string[] = ["pending", "approved", "denied"] satisfies RequestStatus[];

/** Every request, in ID order (1, 2, 3, …). */
export async function getRequests(): Promise<RequestRecord[]> {
  return (requestsJson as RequestRecord[])
    .map((request) => {
      if (STATUSES.includes(request.status)) return request;
      console.warn(`Request ${request.id} has status "${request.status}"; reading it as pending.`);
      return { ...request, status: "pending" as const };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}
