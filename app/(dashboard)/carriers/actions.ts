"use server";

/*
 * Add or edit a carrier, run on the Next server so the access token stays in
 * its HttpOnly cookie. POST /carriers/create/ or PATCH /carriers/{id}/; the
 * API checks the name against every other carrier's name and aliases, needs
 * at least one line of business, and records the change note.
 *
 * What the API answers, and what the form page shows for it:
 *
 *   400 invalid             a field's message under that field
 *   401 token_not_valid     the session is gone            -> back to sign in
 *   403 permission_denied   the role can't change carriers -> under the form
 *   network_error           the API is down                -> under the form
 *
 * On success the carrier pages are revalidated, so the list, the profile,
 * the navbar search index and the request dialog's carrier options all show
 * the change on their next render.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import {
  toCarrierRecord,
  type ApiCarrier,
  type CarrierError,
  type CarrierRecord,
  type CarrierValues,
} from "@/lib/carriers";

export type SaveCarrierResult =
  | { ok: true; carrier: CarrierRecord }
  | { ok: false; errors: CarrierError[] };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, CarrierError["field"]> = {
  name: "name",
  aliases: "aliases",
  lines_of_business: "linesOfBusiness",
  certification_lines: "certificationLines",
  link: "link",
  // The state rows sit under Available states on the form.
  licenses: "availableStates",
  status: "status",
};

/** Adds a carrier, or edits the one with `editingId`. */
export async function saveCarrier(values: CarrierValues, editingId?: string): Promise<SaveCarrierResult> {
  const body = {
    name: values.name,
    aliases: values.aliases,
    lines_of_business: values.linesOfBusiness,
    certification_lines: values.certificationLines,
    link: values.link,
    licenses: values.licenses.map((row) => ({
      state: row.state,
      license_number: row.licenseNumber,
      status: row.status,
      start_date: row.startDate || null,
      end_date: row.endDate || null,
      life: row.life,
      health: row.health,
    })),
    status: values.status,
  };
  const result = editingId
    ? await apiFetch<ApiCarrier>(`/carriers/${encodeURIComponent(editingId)}/`, { method: "PATCH", body })
    : await apiFetch<ApiCarrier>("/carriers/create/", { method: "POST", body });

  if (!result.ok) {
    // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
    if (result.status === 401) redirect("/login");

    if (result.code === "invalid" && result.errors) {
      const errors: CarrierError[] = [];
      for (const [apiField, messages] of Object.entries(result.errors)) {
        errors.push({ field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] });
      }
      return { ok: false, errors: errors.length > 0 ? errors : [{ field: "form", message: result.message }] };
    }
    // Permission denied, not found, throttled, API down: about the attempt, not one field.
    return { ok: false, errors: [{ field: "form", message: result.message }] };
  }

  // Every dashboard page reads carriers (the navbar search and request dialog), so revalidate the lot.
  revalidatePath("/", "layout");
  return { ok: true, carrier: toCarrierRecord(result.data) };
}
