"use server";

/*
 * Add or edit a certification, run on the Next server so the access token
 * stays in its HttpOnly cookie. POST /certifications/create/ or PATCH
 * /certifications/{id}/; the API keeps one live row per agent and policy
 * type, checks the dates, and records the change note.
 *
 * The same action serves both places a certification is edited: the agent
 * profile (agent fixed, `fixed: "agent"`) and the policy types table (type
 * fixed, `fixed: "policyType"`). On an edit only the side the user can
 * change is sent, so the API's duplicate error names that side; on an add
 * both are sent and the API names policy_type. Either way the message lands
 * on the one field the form lets the user choose.
 *
 * What the API answers, and what the dialog shows for it:
 *
 *   400 invalid             a field's message under that field
 *   401 token_not_valid     the session is gone                   -> back to sign in
 *   403 permission_denied   the role can't change certifications  -> under the form
 *   network_error           the API is down                       -> under the form
 *
 * On success every agent profile and the policy types page are revalidated,
 * so their next render agrees with the state the view updated at once.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import {
  toCertificationRecord,
  type ApiCertification,
  type CertificationError,
  type CertificationRecord,
  type CertificationValues,
} from "@/lib/certifications";

export type SaveCertificationResult =
  | { ok: true; certification: CertificationRecord }
  | { ok: false; errors: CertificationError[] };

/** Which side of the pair the form can't change. */
export type CertificationFixed = "agent" | "policyType";

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
function errorFields(fixed: CertificationFixed): Record<string, CertificationError["field"]> {
  // Whichever side is fixed can't be wrong from the form's point of view, so
  // an error about the pair lands on the side the user picked.
  const chosen: CertificationError["field"] = fixed === "agent" ? "policyType" : "agent";
  return {
    agent: chosen,
    policy_type: chosen,
    start_date: "startDate",
    end_date: "endDate",
    is_active: "status",
  };
}

/** Adds a certification, or edits the one with `editingId`. */
export async function saveCertification(
  values: CertificationValues,
  fixed: CertificationFixed,
  editingId?: string,
): Promise<SaveCertificationResult> {
  const dates = {
    start_date: values.startDate || null,
    end_date: values.endDate || null,
    is_active: values.status === "active",
  };
  const result = editingId
    ? await apiFetch<ApiCertification>(`/certifications/${encodeURIComponent(editingId)}/`, {
        method: "PATCH",
        // Only the side the form lets the user change.
        body: fixed === "agent" ? { policy_type: values.policyTypeId, ...dates } : { agent: values.agentId, ...dates },
      })
    : await apiFetch<ApiCertification>("/certifications/create/", {
        method: "POST",
        body: { agent: values.agentId, policy_type: values.policyTypeId, ...dates },
      });

  if (!result.ok) {
    // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
    if (result.status === 401) redirect("/login");

    if (result.code === "invalid" && result.errors) {
      const fields = errorFields(fixed);
      const errors: CertificationError[] = [];
      for (const [apiField, messages] of Object.entries(result.errors)) {
        errors.push({ field: fields[apiField] ?? "form", message: messages[0] });
      }
      return { ok: false, errors: errors.length > 0 ? errors : [{ field: "form", message: result.message }] };
    }
    // Permission denied, not found, throttled, API down: about the attempt, not one field.
    return { ok: false, errors: [{ field: "form", message: result.message }] };
  }

  // An edit may have moved the row to another agent, so every agent profile is revalidated.
  revalidatePath("/agents/[id]", "page");
  revalidatePath("/policy-types");
  return { ok: true, certification: toCertificationRecord(result.data) };
}
