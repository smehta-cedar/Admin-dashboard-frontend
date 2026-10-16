"use server";

/*
 * Add a policy type from the agency's contract dialog, run on the Next server
 * so the access token stays in its HttpOnly cookie. POST /policy-types/create/;
 * the API checks the name against every other live policy type (ignoring
 * case) and records the change note. There is no Policy types page: types are
 * only added here, and stay active.
 *
 * What the API answers, and what the dialog shows for it (under the policy
 * type boxes):
 *
 *   400 invalid             the name's message
 *   401 token_not_valid     the session is gone                -> back to sign in
 *   403 permission_denied   the role can't change policy types
 *   network_error           the API is down
 *
 * On success the dashboard is revalidated: the agency page and the carrier
 * profiles' policy dialogs read the list.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import { toPolicyTypeRecord, type ApiPolicyType, type PolicyTypeRecord } from "@/lib/policy-types";

export type AddPolicyTypeResult = { ok: true; policyType: PolicyTypeRecord } | { ok: false; message: string };

/** Adds an active policy type called `name`. */
export async function addPolicyType(name: string): Promise<AddPolicyTypeResult> {
  const result = await apiFetch<ApiPolicyType>("/policy-types/create/", {
    method: "POST",
    body: { name, is_active: true },
  });

  if (!result.ok) {
    // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
    if (result.status === 401) redirect("/login");
    const [, messages] = (result.code === "invalid" && result.errors && Object.entries(result.errors)[0]) || [];
    return { ok: false, message: messages?.[0] ?? result.message };
  }

  revalidatePath("/", "layout");
  return { ok: true, policyType: toPolicyTypeRecord(result.data) };
}
