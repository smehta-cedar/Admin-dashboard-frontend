"use server";

/*
 * Add or edit a policy type, run on the Next server so the access token stays
 * in its HttpOnly cookie. POST /policy-types/create/ or PATCH
 * /policy-types/{id}/; the API checks the name against every other live
 * policy type (ignoring case) and records the change note.
 *
 * What the API answers, and what the dialog shows for it:
 *
 *   400 invalid             a field's message under that field
 *   401 token_not_valid     the session is gone                -> back to sign in
 *   403 permission_denied   the role can't change policy types -> under the form
 *   network_error           the API is down                    -> under the form
 *
 * On success the list page is revalidated, so its next render agrees with
 * the state the view updated at once.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import {
  toPolicyTypeRecord,
  type ApiPolicyType,
  type PolicyTypeError,
  type PolicyTypeRecord,
  type PolicyTypeValues,
} from "@/lib/policy-types";

export type SavePolicyTypeResult =
  | { ok: true; policyType: PolicyTypeRecord }
  | { ok: false; errors: PolicyTypeError[] };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, PolicyTypeError["field"]> = {
  name: "name",
  is_active: "status",
};

/** Adds a policy type, or edits the one with `editingId`. */
export async function savePolicyType(
  values: PolicyTypeValues,
  editingId?: string,
): Promise<SavePolicyTypeResult> {
  const body = {
    name: values.name,
    is_active: values.status === "active",
  };
  const result = editingId
    ? await apiFetch<ApiPolicyType>(`/policy-types/${encodeURIComponent(editingId)}/`, { method: "PATCH", body })
    : await apiFetch<ApiPolicyType>("/policy-types/create/", { method: "POST", body });

  if (!result.ok) {
    // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
    if (result.status === 401) redirect("/login");

    if (result.code === "invalid" && result.errors) {
      const errors: PolicyTypeError[] = [];
      for (const [apiField, messages] of Object.entries(result.errors)) {
        errors.push({ field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] });
      }
      return { ok: false, errors: errors.length > 0 ? errors : [{ field: "form", message: result.message }] };
    }
    // Permission denied, not found, throttled, API down: about the attempt, not one field.
    return { ok: false, errors: [{ field: "form", message: result.message }] };
  }

  revalidatePath("/policy-types");
  return { ok: true, policyType: toPolicyTypeRecord(result.data) };
}
