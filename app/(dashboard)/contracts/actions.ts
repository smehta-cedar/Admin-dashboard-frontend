"use server";

/*
 * Add or edit a carrier contract (appointment), run on the Next server so
 * the access token stays in its HttpOnly cookie. POST /contracts/create/ or
 * PATCH /contracts/{id}/; the API keeps one contract per agent at each
 * carrier, a writing number unique within the carrier, every appointed
 * state within the agent's licences and the carrier's footprint (naming the
 * side that blocks it), and records the change note.
 *
 * What the API answers, and what the dialog shows for it:
 *
 *   400 invalid             a field's message under that field
 *   401 token_not_valid     the session is gone              -> back to sign in
 *   403 permission_denied   the role can't change contracts  -> under the form
 *   network_error           the API is down                  -> under the form
 *
 * On success the dashboard is revalidated: both Contracts pages, the
 * profiles' Carriers / Agents panels and the navbar search read contracts.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import {
  toContractRecord,
  type ApiContract,
  type AppointmentError,
  type AppointmentValues,
  type CarrierContractRecord,
} from "@/lib/carrier-contracts";

export type SaveAppointmentResult =
  | { ok: true; contract: CarrierContractRecord }
  | { ok: false; error: AppointmentError };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, AppointmentError["field"]> = {
  agent_id: "agentId",
  carrier_id: "carrierId",
  // "Add a contract number before an agent can use this carrier."
  carrier: "carrierId",
  writing_number: "writingNumber",
  appointed_states: "appointedStates",
};

/** Adds a contract, or edits the one with `editingId`. */
export async function saveAppointment(
  values: AppointmentValues,
  editingId?: string,
): Promise<SaveAppointmentResult> {
  const body = {
    agent_id: values.agentId,
    carrier_id: values.carrierId,
    writing_number: values.writingNumber,
    appointed_states: values.appointedStates,
  };
  const result = editingId
    ? await apiFetch<ApiContract>(`/contracts/${encodeURIComponent(editingId)}/`, { method: "PATCH", body })
    : await apiFetch<ApiContract>("/contracts/create/", { method: "POST", body });

  if (!result.ok) {
    // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
    if (result.status === 401) redirect("/login");

    if (result.code === "invalid" && result.errors) {
      // The dialog shows one error at a time; the first field the API named wins.
      const [apiField, messages] = Object.entries(result.errors)[0] ?? ["", [result.message]];
      return { ok: false, error: { field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] } };
    }
    // Permission denied, not found, throttled, API down: about the attempt, not one field.
    return { ok: false, error: { field: "form", message: result.message } };
  }

  revalidatePath("/", "layout");
  return { ok: true, contract: toContractRecord(result.data) };
}
