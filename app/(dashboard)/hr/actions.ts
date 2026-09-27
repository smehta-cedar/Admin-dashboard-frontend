"use server";

/*
 * File an agent's request and set a request's status, run on the Next
 * server so the access token stays in its HttpOnly cookie. POST
 * /requests/create/ and PATCH /requests/{id}/. A 400's field errors go
 * under their fields, a 403 (the role can't file or decide) under the form,
 * a 401 sends the user to sign in.
 *
 * The request list lives in the requests store above every dashboard page,
 * so the store updates its own state from the returned record; the
 * revalidation makes the next server render agree.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import type { RequestError, RequestValues } from "@/lib/request-options";
import { toRequestRecord, type ApiRequest, type RequestRecord, type RequestStatus } from "@/lib/requests";

export type FileRequestResult = { ok: true; request: RequestRecord } | { ok: false; error: RequestError };
export type SetStatusResult = { ok: true; request: RequestRecord } | { ok: false; message: string };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, RequestError["field"]> = {
  agent_id: "agentId",
  state: "state",
  carrier_id: "carrierId",
  start_date: "startDate",
  end_date: "endDate",
};

const API_TYPES = { licensing: "licensing", contract: "contract", dayOff: "day_off" } as const;

/** Files a pending request for the agent in `values`. */
export async function fileRequest(values: RequestValues): Promise<FileRequestResult> {
  const placement = values.type === "licensing" || values.type === "contract";
  const body = {
    type: API_TYPES[values.type],
    agent_id: values.agentId,
    note: values.note,
    ...(placement ? { state: values.state, carrier_id: values.carrierId } : {}),
    ...(values.type === "dayOff" ? { start_date: values.startDate, end_date: values.endDate } : {}),
  };
  const result = await apiFetch<ApiRequest>("/requests/create/", { method: "POST", body });

  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    if (result.code === "invalid" && result.errors) {
      const [apiField, messages] = Object.entries(result.errors)[0] ?? ["", [result.message]];
      return { ok: false, error: { field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] } };
    }
    return { ok: false, error: { field: "form", message: result.message } };
  }

  const request = toRequestRecord(result.data);
  if (!request) return { ok: false, error: { field: "form", message: "The API answered with an unusable request." } };
  revalidatePath("/", "layout");
  return { ok: true, request };
}

/** HR's decision on one request. */
export async function setRequestStatus(id: string, status: RequestStatus): Promise<SetStatusResult> {
  const result = await apiFetch<ApiRequest>(`/requests/${encodeURIComponent(id)}/`, {
    method: "PATCH",
    body: { status },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    return { ok: false, message: result.message };
  }
  const request = toRequestRecord(result.data);
  if (!request) return { ok: false, message: "The API answered with an unusable request." };
  revalidatePath("/", "layout");
  return { ok: true, request };
}
