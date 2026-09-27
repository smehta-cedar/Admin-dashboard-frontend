"use server";

/*
 * Add or edit one of a carrier's policies, run on the Next server so the
 * access token stays in its HttpOnly cookie. POST /carrier-policies/create/
 * or PATCH /carrier-policies/{id}/; the API checks the name against the
 * carrier's other live policies (ignoring case), checks every state against
 * the carrier's available states, and records the change note.
 *
 * What the API answers, and what the dialog shows for it:
 *
 *   400 invalid             a field's message under that field
 *   401 token_not_valid     the session is gone              -> back to sign in
 *   403 permission_denied   the role can't change carriers   -> under the form
 *   network_error           the API is down                  -> under the form
 *
 * On success the carrier's profile is revalidated, so its next render agrees
 * with the state the profile updated at once.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import {
  toCarrierPolicyRecord,
  type ApiCarrierPolicy,
  type CarrierPolicyError,
  type CarrierPolicyRecord,
  type CarrierPolicyValues,
} from "@/lib/carrier-policies";

export type SaveCarrierPolicyResult =
  | { ok: true; policy: CarrierPolicyRecord }
  | { ok: false; errors: CarrierPolicyError[] };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, CarrierPolicyError["field"]> = {
  name: "name",
  policy_type: "policyType",
  available_states: "availableStates",
  is_active: "status",
};

/** Adds a policy to the carrier with `carrierId`, or edits the one with `editingId`. */
export async function saveCarrierPolicy(
  carrierId: string,
  values: CarrierPolicyValues,
  editingId?: string,
): Promise<SaveCarrierPolicyResult> {
  const body = {
    policy_type: values.policyTypeId,
    name: values.name,
    available_states: values.availableStates,
    is_active: values.status === "active",
  };
  const result = editingId
    ? await apiFetch<ApiCarrierPolicy>(`/carrier-policies/${encodeURIComponent(editingId)}/`, {
        method: "PATCH",
        body,
      })
    : await apiFetch<ApiCarrierPolicy>("/carrier-policies/create/", {
        method: "POST",
        body: { carrier: carrierId, ...body },
      });

  if (!result.ok) {
    // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
    if (result.status === 401) redirect("/login");

    if (result.code === "invalid" && result.errors) {
      const errors: CarrierPolicyError[] = [];
      for (const [apiField, messages] of Object.entries(result.errors)) {
        errors.push({ field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] });
      }
      return { ok: false, errors: errors.length > 0 ? errors : [{ field: "form", message: result.message }] };
    }
    // Permission denied, not found, throttled, API down: about the attempt, not one field.
    return { ok: false, errors: [{ field: "form", message: result.message }] };
  }

  revalidatePath(`/carriers/${carrierId}`);
  return { ok: true, policy: toCarrierPolicyRecord(result.data) };
}
