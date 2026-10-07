"use server";

/*
 * Add or edit a certification, run on the Next server so the access token
 * stays in its HttpOnly cookie. POST /certifications/create/ or PATCH
 * /certifications/{id}/; the API records the change note. Only the agent is
 * required and nothing else is checked: a certification is an add-on. A
 * blank due date on a new row is defaulted by the API to the next deadline.
 *
 * Certifications are edited from the agent profile and the agent form, both
 * with the agent fixed, so an edit never sends the agent.
 *
 * When the form picked a PDF the body goes as multipart form data with the
 * file alongside the other fields; otherwise it is JSON and the stored file
 * is left alone. The API takes PDFs of up to 10 MB and names anything else
 * under file.
 *
 * What the API answers, and what the dialog shows for it:
 *
 *   400 invalid             a field's message under that field
 *   401 token_not_valid     the session is gone                   -> back to sign in
 *   403 permission_denied   the role can't change certifications  -> under the form
 *   network_error           the API is down                       -> under the form
 *
 * On success every agent profile is revalidated, so its next render agrees
 * with the state the view updated at once.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { allowForbidden, apiFetch } from "@/lib/api-server";
import {
  getCertifications,
  toCertificationRecord,
  type ApiCertification,
  type CertificationError,
  type CertificationRecord,
  type CertificationValues,
} from "@/lib/certifications";

export type SaveCertificationResult =
  | { ok: true; certification: CertificationRecord }
  | { ok: false; errors: CertificationError[] };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, CertificationError["field"]> = {
  agent: "agent",
  carrier: "carrier",
  line_of_business: "lineOfBusiness",
  due_date: "dueDate",
  start_date: "startDate",
  end_date: "endDate",
  is_verified: "isVerified",
  file: "file",
  is_active: "status",
};

/**
 * `fields` as multipart form data with `file` alongside; a null value goes
 * as "" (cleared).
 */
function toFormData(fields: Record<string, string | boolean | null | undefined>, file: File): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined) data.set(name, value === null ? "" : String(value));
  }
  data.set("file", file);
  return data;
}

/** Adds a certification, or edits the one with `editingId`. */
export async function saveCertification(
  values: CertificationValues,
  editingId?: string,
): Promise<SaveCertificationResult> {
  const details = {
    carrier: values.carrierId || null,
    line_of_business: values.lineOfBusiness,
    // A new row with no due date gets the API's default; an edit can clear it.
    due_date: values.dueDate || (editingId ? null : undefined),
    start_date: values.startDate || null,
    end_date: values.endDate || null,
    // Undefined keys drop out of the JSON body and are skipped in the multipart one.
    is_verified: values.isVerified,
    is_active: values.status === "active",
  };
  const fields = editingId ? details : { agent: values.agentId, ...details };
  const body = values.file ? toFormData(fields, values.file) : fields;
  const result = editingId
    ? await apiFetch<ApiCertification>(`/certifications/${encodeURIComponent(editingId)}/`, { method: "PATCH", body })
    : await apiFetch<ApiCertification>("/certifications/create/", { method: "POST", body });

  if (!result.ok) {
    // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
    if (result.status === 401) redirect("/login");

    if (result.code === "invalid" && result.errors) {
      const errors: CertificationError[] = [];
      for (const [apiField, messages] of Object.entries(result.errors)) {
        errors.push({ field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] });
      }
      return { ok: false, errors: errors.length > 0 ? errors : [{ field: "form", message: result.message }] };
    }
    // Permission denied, not found, throttled, API down: about the attempt, not one field.
    return { ok: false, errors: [{ field: "form", message: result.message }] };
  }

  revalidatePath("/agents/[id]", "page");
  return { ok: true, certification: toCertificationRecord(result.data) };
}

/**
 * One agent's certifications as they are now, e.g. after adding a carrier
 * gave them new ones; null when the role can't see certifications.
 */
export async function listAgentCertifications(agentId: string): Promise<CertificationRecord[] | null> {
  return allowForbidden(getCertifications({ agentId }));
}

/** Removes a certification. The API soft-deletes it. */
export async function deleteCertification(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await apiFetch<null>(`/certifications/${encodeURIComponent(id)}/`, { method: "DELETE" });
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    return { ok: false, message: result.message };
  }
  revalidatePath("/agents/[id]", "page");
  return { ok: true };
}
