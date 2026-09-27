import "server-only";

/*
 * Data boundary for HR requests: reads the Django API (`/api/v1/requests/`,
 * backend/apps/requests) as the signed-in user. Filing and status changes go
 * through the server actions in app/(dashboard)/hr/actions.ts; the shop
 * under Storefront files merch orders through its own actions.ts, also as
 * the signed-in user.
 *
 * A request is one agent asking for one thing: a licence in a state with a
 * carrier, a contract with a carrier in a state, or days off. Every request
 * starts pending; HR sets it approved or denied on the HR page. The
 * Create-a-request button in the navbar files one from anywhere, so the list
 * is held in a client provider on the dashboard layout
 * (components/requests-store.tsx). Labels, the status list and the form
 * checks are client-safe in lib/request-options.ts.
 *
 * A merch request is the one kind not tied to an agent: an order placed for
 * a client in the shop at /storefront/shop. It carries the buyer's own
 * contact details instead of an agentId.
 *
 * data/requests.json and data/merch-requests.json are no longer read here;
 * they are the seed files for `python manage.py seed_requests`.
 */

import { apiGetAll } from "@/lib/api-server";
import { formatPhone } from "@/lib/phone";

export type RequestType = "licensing" | "contract" | "dayOff" | "merch";

/** The types the Create-a-request dialog files: every one names an agent. */
export type AgentRequestType = Exclude<RequestType, "merch">;

export type RequestStatus = "pending" | "approved" | "denied";

type RequestBase = {
  /** The API's UUID. */
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
  /** The agent's name as of the read. */
  agentName: string;
} & (
    /** State code from lib/us-states.ts, and the carrier the licence or contract is with. */
    | { type: "licensing"; state: string; carrierId: string; carrierName: string }
    | { type: "contract"; state: string; carrierId: string; carrierName: string }
    | {
        type: "dayOff";
        /** "YYYY-MM-DD", inclusive. */
        startDate: string;
        /** "YYYY-MM-DD", inclusive, on or after startDate. */
        endDate: string;
      }
  );

/** A merch order from the shop under Storefront. Options and labels live in lib/shop.ts. */
export type MerchRequestRecord = RequestBase & {
  type: "merch";
  /** The product ordered, or null when it has since been deleted. */
  productId: string | null;
  productName: string;
  buyerName: string;
  email: string;
  /** In the one display format (lib/phone.ts). */
  phone: string;
  /** Shipping address as typed, may span lines. */
  address: string;
  size: string;
  /** The colour's label, e.g. "Teal". */
  color: string;
  quantity: number;
};

export type RequestRecord = AgentRequestRecord | MerchRequestRecord;

/** A request as the API serialises it (RequestSerializer). */
export type ApiRequest = {
  id: string;
  type: "licensing" | "contract" | "day_off" | "merch";
  status: string;
  note: string;
  agent: { id: string; name: string; is_active: boolean } | null;
  carrier: { id: string; name: string; is_active: boolean } | null;
  state: string | null;
  start_date: string | null;
  end_date: string | null;
  product: { id: string; name: string; is_active: boolean } | null;
  buyer_name: string;
  email: string;
  phone: string;
  address: string;
  size: string;
  color: string;
  quantity: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const STATUSES: readonly string[] = ["pending", "approved", "denied"] satisfies RequestStatus[];

/**
 * An API request as the app holds it, or null when the row is missing what
 * its type needs (an agent request with no agent), which is logged and
 * skipped rather than crashing the page.
 */
export function toRequestRecord(request: ApiRequest): RequestRecord | null {
  const knownStatus = STATUSES.includes(request.status);
  if (!knownStatus) {
    console.warn(`Request ${request.id} has status "${request.status}"; reading it as pending.`);
  }
  const base = {
    id: request.id,
    status: knownStatus ? (request.status as RequestStatus) : ("pending" as const),
    createdAt: request.created_at,
    ...(request.note ? { note: request.note } : {}),
  };

  if (request.type === "merch") {
    return {
      ...base,
      type: "merch",
      productId: request.product?.id ?? null,
      productName: request.product?.name ?? "Cedar Grove Tee",
      buyerName: request.buyer_name,
      email: request.email,
      phone: formatPhone(request.phone),
      address: request.address,
      size: request.size,
      color: request.color,
      quantity: request.quantity ?? 1,
    };
  }

  if (!request.agent) {
    console.warn(`Request ${request.id} (${request.type}) has no agent; skipping it.`);
    return null;
  }
  const agent = { agentId: request.agent.id, agentName: request.agent.name };

  if (request.type === "day_off") {
    return {
      ...base,
      ...agent,
      type: "dayOff",
      startDate: request.start_date ?? "",
      endDate: request.end_date ?? "",
    };
  }

  return {
    ...base,
    ...agent,
    type: request.type,
    state: request.state ?? "",
    carrierId: request.carrier?.id ?? "",
    carrierName: request.carrier?.name ?? `Carrier ${request.carrier?.id ?? "?"}`,
  };
}

/** Every request, oldest first. */
export async function getRequests(): Promise<RequestRecord[]> {
  const requests = await apiGetAll<ApiRequest>("/requests/");
  return requests.flatMap((request) => {
    const record = toRequestRecord(request);
    return record ? [record] : [];
  });
}
