/*
 * The client-safe half of requests: the type and status lists, their labels,
 * and the checks the Create-a-request dialog runs before it calls the server
 * action. The record types and the API load live in lib/requests.ts
 * (server-only).
 */

import type { AgentRequestType, RequestStatus, RequestType } from "@/lib/requests";

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

/** A save error, shown under the field it names, or under the form for `form`. */
export type RequestError = {
  field: "agentId" | "state" | "carrierId" | "startDate" | "endDate" | "form";
  message: string;
};

/**
 * The checks the form can run itself before the API: every request names an
 * agent; licensing and contract need a state and a carrier; a day off needs
 * its end date on or after its start. The API runs the same checks again.
 */
export function checkRequestValues(values: RequestValues): RequestError | null {
  if (!values.agentId) return { field: "agentId", message: "Choose an agent." };

  switch (values.type) {
    case "licensing":
    case "contract":
      if (!values.state) return { field: "state", message: "Choose a state." };
      if (!values.carrierId) return { field: "carrierId", message: "Choose a carrier." };
      return null;
    case "dayOff":
      if (!values.startDate) return { field: "startDate", message: "Enter the first day off." };
      if (!values.endDate) return { field: "endDate", message: "Enter the last day off." };
      // ISO dates compare as text.
      if (values.endDate < values.startDate) {
        return { field: "endDate", message: "The last day can't be before the first." };
      }
      return null;
  }
}
