"use server";

/*
 * Add or edit a user account, run on the Next server so the access token
 * stays in its HttpOnly cookie. The users API splits a user's changes over
 * a few endpoints, so one save may make up to three calls:
 *
 *   add   POST /users/create/                 (password required)
 *   edit  PATCH /users/{id}/                  name, email, phone, role
 *         POST /users/{id}/block/ or unblock/ when the status changed
 *         POST /users/{id}/set-password/      when a new password was typed
 *
 * The API records a change note for each. It also refuses some things by
 * rule (only a superuser may change a superuser; nobody may block themselves
 * or change their own role) and answers 403 with a message, shown under the
 * form. A 400's field errors go under their fields; a 401 sends the user to
 * sign in.
 *
 * On success the dashboard is revalidated (the navbar search reads users).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import type { ApiUser } from "@/lib/auth-user";
import { toUserRecord, type UserError, type UserRecord, type UserValues } from "@/lib/users";

export type SaveUserResult = { ok: true; user: UserRecord } | { ok: false; error: UserError };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, UserError["field"]> = {
  full_name: "name",
  email: "email",
  phone: "phone",
  role_id: "roleId",
  password: "password",
  new_password: "password",
  confirm_password: "password",
};

type Failure = { ok: false; status: number; code: string; message: string; errors: Record<string, string[]> | null };

function toError(failure: Failure): UserError {
  if (failure.status === 401) redirect("/login");
  if (failure.code === "invalid" && failure.errors) {
    // The form shows one error at a time; the first field the API named wins.
    const [apiField, messages] = Object.entries(failure.errors)[0] ?? ["", [failure.message]];
    return { field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] };
  }
  // Permission denied (the API's rules), throttled, API down: about the attempt, not one field.
  return { field: "form", message: failure.message };
}

/** Adds a user, or edits the one with `editing`. */
export async function saveUser(values: UserValues, editing?: UserRecord): Promise<SaveUserResult> {
  const fields = {
    email: values.email,
    full_name: values.name,
    phone: values.phone,
    role_id: values.roleId || null,
  };

  if (!editing) {
    const result = await apiFetch<ApiUser>("/users/create/", {
      method: "POST",
      body: { ...fields, password: values.password },
    });
    if (!result.ok) return { ok: false, error: toError(result) };
    let user = result.data;
    // A new user starts active; block them when the form said inactive.
    if (values.status === "inactive") {
      const blocked = await apiFetch<ApiUser>(`/users/${user.id}/block/`, { method: "POST" });
      if (!blocked.ok) return { ok: false, error: toError(blocked) };
      user = blocked.data;
    }
    revalidatePath("/", "layout");
    return { ok: true, user: toUserRecord(user) };
  }

  const id = encodeURIComponent(editing.id);
  let user: ApiUser | null = null;

  const changed =
    fields.email !== editing.email ||
    fields.full_name !== editing.name ||
    fields.phone !== editing.phone ||
    (fields.role_id ?? null) !== (editing.role?.id ?? null);
  if (changed) {
    const result = await apiFetch<ApiUser>(`/users/${id}/`, { method: "PATCH", body: fields });
    if (!result.ok) return { ok: false, error: toError(result) };
    user = result.data;
  }

  if (values.status !== editing.status) {
    const path = values.status === "inactive" ? `/users/${id}/block/` : `/users/${id}/unblock/`;
    const result = await apiFetch<ApiUser>(path, { method: "POST" });
    if (!result.ok) return { ok: false, error: toError(result) };
    user = result.data;
  }

  if (values.password) {
    const result = await apiFetch<null>(`/users/${id}/set-password/`, {
      method: "POST",
      body: { new_password: values.password, confirm_password: values.password },
    });
    if (!result.ok) return { ok: false, error: toError(result) };
  }

  if (user === null) {
    // Nothing but maybe the password changed; read the record back for the list.
    const result = await apiFetch<ApiUser>(`/users/${id}/`);
    if (!result.ok) return { ok: false, error: toError(result) };
    user = result.data;
  }

  revalidatePath("/", "layout");
  return { ok: true, user: toUserRecord(user) };
}
