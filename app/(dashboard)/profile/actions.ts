"use server";

/*
 * Change the signed-in user's password, run on the Next server so the access
 * token stays in its HttpOnly cookie. POST /auth/change-password/ checks the
 * current password and the new one's strength, revokes the user's tokens and
 * issues a fresh pair, which is stored here so this session stays signed in.
 *
 * What the endpoint answers, and what the dialog shows for it:
 *
 *   400 invalid          wrong current password, weak or unchanged new password,
 *                        mismatched confirmation                -> under that field
 *   401 token_not_valid  the session is gone                    -> back to sign in
 *   429 throttled        10 attempts a minute                   -> the API's message
 *   network_error        the API is down                        -> "Can't reach the server."
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiRequest, type TokenPair } from "@/lib/api";
import { ACCESS_COOKIE, clearAuthCookies, setAuthCookies } from "@/lib/auth-cookies";

export type ChangePasswordField = "currentPassword" | "newPassword" | "confirmPassword";

/** Messages for the dialog: one per field where the API named it, otherwise one for the whole form. */
export type ChangePasswordState = {
  fieldErrors: Partial<Record<ChangePasswordField, string>>;
  error: string | null;
  /** True once the password has changed; the dialog swaps to its confirmation. */
  done: boolean;
};

const NO_ERRORS: ChangePasswordState = { fieldErrors: {}, error: null, done: false };

/** API field name -> form field name. */
const FIELD_NAMES: Record<string, ChangePasswordField> = {
  current_password: "currentPassword",
  new_password: "newPassword",
  confirm_password: "confirmPassword",
};

export async function changePassword(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  // Not trimmed: spaces and case matter in a password.
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: ChangePasswordState["fieldErrors"] = {};
  if (!currentPassword) fieldErrors.currentPassword = "Enter your current password.";
  if (!newPassword) fieldErrors.newPassword = "Enter a new password.";
  if (!confirmPassword) fieldErrors.confirmPassword = "Repeat the new password.";
  else if (newPassword && confirmPassword !== newPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }
  if (Object.keys(fieldErrors).length > 0) return { ...NO_ERRORS, fieldErrors };

  const cookieStore = await cookies();
  const access = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!access) redirect("/login");

  const result = await apiRequest<TokenPair>("/auth/change-password/", {
    method: "POST",
    token: access,
    body: {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    },
  });

  if (!result.ok) {
    if (result.status === 401) {
      // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
      clearAuthCookies(cookieStore);
      redirect("/login");
    }
    if (result.code === "invalid" && result.errors) {
      // A 400 names the fields; each message goes under its own input, anything else under the form.
      let other: string | undefined;
      for (const [apiField, messages] of Object.entries(result.errors)) {
        const field = FIELD_NAMES[apiField];
        if (field) fieldErrors[field] = messages[0];
        else other ??= messages[0];
      }
      return {
        ...NO_ERRORS,
        fieldErrors,
        error: other ?? (Object.keys(fieldErrors).length > 0 ? null : result.message),
      };
    }
    // Throttled, API down: about the attempt, not one field.
    return { ...NO_ERRORS, error: result.message };
  }

  // The API revoked the old tokens; keep this session signed in with the new pair.
  setAuthCookies(cookieStore, result.data);
  return { ...NO_ERRORS, done: true };
}
