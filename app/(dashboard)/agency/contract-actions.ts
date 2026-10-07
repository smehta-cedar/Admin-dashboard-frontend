"use server";

/*
 * Add or edit one of the agency's carrier contracts, run on the Next server
 * so the access token stays in its HttpOnly cookie. POST
 * /agency-contracts/create/ or PATCH /agency-contracts/{id}/; the API keeps
 * one live contract per carrier, checks the policy types exist, and records
 * the change note.
 *
 * What the API answers, and what the dialog shows for it:
 *
 *   400 invalid             a field's message under that field
 *   401 token_not_valid     the session is gone                  -> back to sign in
 *   403 permission_denied   the role can't change agency contracts -> under the form
 *   network_error           the API is down                      -> under the form
 *
 * On success the agency page and every page with a carrier dropdown for
 * agents are revalidated: a new or cleared contract number changes which
 * carriers those dropdowns offer.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  toAgencyContractRecord,
  type AgencyContractError,
  type AgencyContractRecord,
  type AgencyContractValues,
  type ApiAgencyContract,
} from "@/lib/agency-contracts";
import { apiFetch } from "@/lib/api-server";

export type SaveAgencyContractResult =
  | { ok: true; contract: AgencyContractRecord }
  | { ok: false; errors: AgencyContractError[] };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, AgencyContractError["field"]> = {
  carrier: "carrierId",
  contract_number: "contractNumber",
  is_active: "status",
};

/** Adds a contract for the agency with `agencyId`, or edits the one with `editingId`. */
export async function saveAgencyContract(
  agencyId: string,
  values: AgencyContractValues,
  editingId?: string,
): Promise<SaveAgencyContractResult> {
  const body = {
    carrier: values.carrierId,
    contract_number: values.contractNumber,
    policy_types: values.policyTypeIds,
    is_active: values.status === "active",
  };
  const result = editingId
    ? await apiFetch<ApiAgencyContract>(`/agency-contracts/${encodeURIComponent(editingId)}/`, {
        method: "PATCH",
        body,
      })
    : await apiFetch<ApiAgencyContract>("/agency-contracts/create/", {
        method: "POST",
        body: { agency: agencyId, ...body },
      });

  if (!result.ok) {
    // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
    if (result.status === 401) redirect("/login");

    if (result.code === "invalid" && result.errors) {
      const errors: AgencyContractError[] = [];
      for (const [apiField, messages] of Object.entries(result.errors)) {
        errors.push({ field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] });
      }
      return { ok: false, errors: errors.length > 0 ? errors : [{ field: "form", message: result.message }] };
    }
    // Permission denied, not found, throttled, API down: about the attempt, not one field.
    return { ok: false, errors: [{ field: "form", message: result.message }] };
  }

  // Everything under the dashboard: the agency page, and every carrier dropdown for agents.
  revalidatePath("/", "layout");
  return { ok: true, contract: toAgencyContractRecord(result.data) };
}
