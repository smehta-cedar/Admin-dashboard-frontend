"use server";

/*
 * Add or edit a password, run on the Next server so the access token stays
 * in its HttpOnly cookie. POST /passwords/create/ or PATCH /passwords/{id}/;
 * the API keeps one password per agent at each carrier, rejects a blank
 * password, and records the change note (the password only as set/changed).
 *
 * What the API answers, and what the dialog shows for it:
 *
 *   400 invalid             a field's message under that field
 *   401 token_not_valid     the session is gone              -> back to sign in
 *   403 permission_denied   the role can't change passwords  -> under the form
 *   network_error           the API is down                  -> under the form
 *
 * On success the dashboard is revalidated: the profiles' Passwords panels and
 * the navbar search read passwords too.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import {
  toPasswordRecord,
  type ApiPassword,
  type PasswordError,
  type PasswordRecord,
  type PasswordValues,
} from "@/lib/passwords";

export type SavePasswordResult =
  | { ok: true; password: PasswordRecord }
  | { ok: false; errors: PasswordError[] };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, PasswordError["field"]> = {
  agent_id: "agentId",
  carrier_id: "carrierId",
  username: "username",
  portal_password: "portalPassword",
  status: "status",
};

/** Adds a password, or edits the one with `editingId`. */
export async function savePassword(values: PasswordValues, editingId?: string): Promise<SavePasswordResult> {
  const body = {
    agent_id: values.agentId,
    carrier_id: values.carrierId,
    username: values.username,
    portal_password: values.portalPassword,
    status: values.status,
  };
  const result = editingId
    ? await apiFetch<ApiPassword>(`/passwords/${encodeURIComponent(editingId)}/`, { method: "PATCH", body })
    : await apiFetch<ApiPassword>("/passwords/create/", { method: "POST", body });

  if (!result.ok) {
    // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
    if (result.status === 401) redirect("/login");

    if (result.code === "invalid" && result.errors) {
      const errors: PasswordError[] = [];
      for (const [apiField, messages] of Object.entries(result.errors)) {
        errors.push({ field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] });
      }
      return { ok: false, errors: errors.length > 0 ? errors : [{ field: "form", message: result.message }] };
    }
    // Permission denied, not found, throttled, API down: about the attempt, not one field.
    return { ok: false, errors: [{ field: "form", message: result.message }] };
  }

  revalidatePath("/", "layout");
  return { ok: true, password: toPasswordRecord(result.data) };
}
