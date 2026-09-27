"use server";

/*
 * Add, edit or delete a role, run on the Next server so the access token
 * stays in its HttpOnly cookie. POST /roles/create/, PATCH /roles/{id}/ or
 * DELETE /roles/{id}/; the API lets only a superuser make any of them.
 *
 * What the API answers, and what the dialog shows for it:
 *
 *   400 invalid             a field's message under that field; a delete
 *                           refused because users still hold the role, or a
 *                           permission without view, under the form
 *   401 token_not_valid     the session is gone              -> back to sign in
 *   403 permission_denied   not a superuser                  -> under the form
 *   network_error           the API is down                  -> under the form
 *
 * On success the dashboard is revalidated: the Users page's role dropdown
 * reads roles too.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import { toRoleRecord, type ApiRole, type RoleError, type RoleRecord, type RoleValues } from "@/lib/roles";

export type SaveRoleResult = { ok: true; role: RoleRecord } | { ok: false; error: RoleError };
export type DeleteRoleResult = { ok: true } | { ok: false; error: RoleError };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, RoleError["field"]> = {
  name: "name",
  description: "description",
  permissions: "permissions",
};

type Failure = { ok: false; status: number; code: string; message: string; errors: Record<string, string[]> | null };

function toError(failure: Failure): RoleError {
  // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
  if (failure.status === 401) redirect("/login");
  if (failure.code === "invalid" && failure.errors) {
    // The form shows one error at a time; the first field the API named wins.
    const [apiField, messages] = Object.entries(failure.errors)[0] ?? ["", [failure.message]];
    const message = Array.isArray(messages) ? String(messages[0] ?? failure.message) : failure.message;
    return { field: ERROR_FIELDS[apiField] ?? "form", message };
  }
  // Permission denied, not found, throttled, API down: about the attempt, not one field.
  return { field: "form", message: failure.message };
}

/** Adds a role, or edits the one with `editingId`. */
export async function saveRole(values: RoleValues, editingId?: string): Promise<SaveRoleResult> {
  const body = {
    name: values.name,
    description: values.description,
    is_active: values.status === "active",
    // Every module the form holds; the API drops the access of any left out.
    permissions: Object.entries(values.permissions).map(([module, flags]) => ({
      module,
      can_view: flags.view,
      can_create: flags.create,
      can_update: flags.update,
      can_delete: flags.delete,
    })),
  };
  const result = editingId
    ? await apiFetch<ApiRole>(`/roles/${encodeURIComponent(editingId)}/`, { method: "PATCH", body })
    : await apiFetch<ApiRole>("/roles/create/", { method: "POST", body });

  if (!result.ok) return { ok: false, error: toError(result) };

  revalidatePath("/", "layout");
  return { ok: true, role: toRoleRecord(result.data) };
}

/** Deletes a role nobody holds any more. */
export async function deleteRole(id: string): Promise<DeleteRoleResult> {
  const result = await apiFetch<null>(`/roles/${encodeURIComponent(id)}/`, { method: "DELETE" });
  if (!result.ok) return { ok: false, error: toError(result) };

  revalidatePath("/", "layout");
  return { ok: true };
}
