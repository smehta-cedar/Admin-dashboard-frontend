"use server";

/*
 * Edit the agency, run on the Next server so the access token stays in its
 * HttpOnly cookie. PATCH /agencies/{id}/; the API checks the name and NPN
 * against other agencies, replaces the licence rows from the checked states
 * and their numbers, and records the change note.
 *
 * What the API answers, and what the form shows for it:
 *
 *   400 invalid             a field's message under that field
 *   401 token_not_valid     the session is gone            -> back to sign in
 *   403 permission_denied   the role can't change agencies -> under the form
 *   network_error           the API is down                -> under the form
 *
 * On success the dashboard is revalidated (Contracts reads the agency's
 * licence numbers).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  toAgencyLicenseRecords,
  toAgencyRecord,
  type AgencyRecord,
  type AgencyValues,
  type ApiAgency,
} from "@/lib/agency";
import type { AgencyStateLicenseRecord } from "@/lib/agency-state-licenses";
import { apiFetch } from "@/lib/api-server";
import type { ProducerError } from "@/components/producer-form";

export type SaveAgencyResult =
  | { ok: true; agency: AgencyRecord; licenses: AgencyStateLicenseRecord[] }
  | { ok: false; error: ProducerError };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, ProducerError["field"]> = {
  name: "name",
  npn: "npn",
  licenses: "licenseNumbers",
};

/** Edits the agency with `id`. Resolves with the saved agency and its licence rows. */
export async function saveAgency(values: AgencyValues, id: string): Promise<SaveAgencyResult> {
  const body = {
    name: values.name,
    aliases: values.aliases,
    npn: values.npn,
    email: values.email,
    phone: values.phone,
    is_active: values.status === "active",
    licenses: values.licensedStates.map((state) => ({
      state,
      license_number: values.licenseNumbers[state] ?? "",
    })),
  };
  const result = await apiFetch<ApiAgency>(`/agencies/${encodeURIComponent(id)}/`, { method: "PATCH", body });

  if (!result.ok) {
    // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
    if (result.status === 401) redirect("/login");

    if (result.code === "invalid" && result.errors) {
      // The form shows one error at a time; the first field the API named wins.
      const [apiField, messages] = Object.entries(result.errors)[0] ?? ["", [result.message]];
      return { ok: false, error: { field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] } };
    }
    // Permission denied, not found, throttled, API down: about the attempt, not one field.
    return { ok: false, error: { field: "form", message: result.message } };
  }

  revalidatePath("/", "layout");
  return { ok: true, agency: toAgencyRecord(result.data), licenses: toAgencyLicenseRecords(result.data) };
}
