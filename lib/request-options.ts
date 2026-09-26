/*
 * The client-safe half of requests: the type and status lists their labels,
 * and the pure `newRequest` the Create-a-request dialog saves through. The
 * record types and the JSON load live in lib/requests.ts (server-only).
 */

import { nextId } from "@/lib/change-notes";
import type { AgentRequestType, RequestRecord, RequestStatus, RequestType } from "@/lib/requests";

/** What the Create-a-request dialog offers. Merch is filed by the shop, never here. */
export const REQUEST_TYPES: readonly AgentRequestType[] = ["licensing", "contract", "dayOff"];

/** Every type, for the HR table's Type column. */
export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  licensing: "Licensing",
  contract: "Contract",
  dayOff: "Day off",
  merch: "Merch",
};

export const REQUEST_STATUSES: readonly RequestStatus[] = ["pending", "approved", "denied"];

/** What the dialog hands over: licensing and contract read state and carrier; a day off reads its dates. */
export type RequestValues = {
  type: AgentRequestType;
  agentId: string;
  note: string;
  state: string;
  carrierId: string;
  startDate: string;
  endDate: string;
};

/** A save error, shown under the field it names. */
export type RequestError = {
  field: "agentId" | "state" | "carrierId" | "startDate" | "endDate";
  message: string;
};

type NewRequestResult = { error: RequestError; request: null } | { error: null; request: RequestRecord };

/**
 * Builds a pending request from the dialog's values, pure. Every request
 * names an agent; a day off also needs its end date on or after its start.
 * The ID follows the highest existing one.
 */
export function newRequest(values: RequestValues, existing: RequestRecord[], now = new Date()): NewRequestResult {
  if (!values.agentId) return { error: { field: "agentId", message: "Choose an agent." }, request: null };

  const base = {
    id: nextId(existing),
    agentId: values.agentId,
    status: "pending" as const,
    createdAt: now.toISOString(),
    ...(values.note ? { note: values.note } : {}),
  };

  switch (values.type) {
    case "licensing":
    case "contract": {
      if (!values.state) return { error: { field: "state", message: "Choose a state." }, request: null };
      if (!values.carrierId) {
        return { error: { field: "carrierId", message: "Choose a carrier." }, request: null };
      }
      return {
        error: null,
        request: { ...base, type: values.type, state: values.state, carrierId: values.carrierId },
      };
    }
    case "dayOff":
      if (!values.startDate) {
        return { error: { field: "startDate", message: "Enter the first day off." }, request: null };
      }
      if (!values.endDate) {
        return { error: { field: "endDate", message: "Enter the last day off." }, request: null };
      }
      // ISO dates compare as text.
      if (values.endDate < values.startDate) {
        return {
          error: { field: "endDate", message: "The last day can't be before the first." },
          request: null,
        };
      }
      return {
        error: null,
        request: { ...base, type: "dayOff", startDate: values.startDate, endDate: values.endDate },
      };
  }
}
