import "server-only";

/*
 * The signed-in agent's own HR requests: GET/POST /api/v1/requests/mine/.
 * Staff use lib/requests.ts against the full list; agents never see another
 * agent's rows. Carriers come with the GET so the create dialog can offer them
 * without a separate carriers permission.
 */

import { apiFetch } from "@/lib/api-server";
import type { AgentStatus } from "@/lib/agent-statuses";
import type { CarrierStatus } from "@/lib/carrier-statuses";
import { toCarrierStatus } from "@/lib/carrier-statuses";
import {
  toRequestRecord,
  type ApiRequest,
  type RequestRecord,
} from "@/lib/requests";

type ApiMinePayload = {
  requests: ApiRequest[];
  carriers: { id: string; name: string; status: string; is_active: boolean }[];
};

export type AgentRequestParty = { id: string; name: string; status: CarrierStatus | AgentStatus };

export type AgentMineBundle = {
  requests: RequestRecord[];
  carriers: AgentRequestParty[];
};

/** This agent's requests and active carriers, or null when the API refuses. */
export async function getMyRequests(): Promise<AgentMineBundle | null> {
  const result = await apiFetch<ApiMinePayload>("/requests/mine/");
  if (!result.ok) return null;
  return {
    requests: result.data.requests.flatMap((row) => {
      const record = toRequestRecord(row);
      return record ? [record] : [];
    }),
    carriers: result.data.carriers.map((carrier) => ({
      id: carrier.id,
      name: carrier.name,
      status: toCarrierStatus(carrier.status, carrier.is_active, carrier.name),
    })),
  };
}
